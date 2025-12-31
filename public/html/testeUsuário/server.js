const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214, maxPayload: 500 * 1024 * 1024 }); // 500 MB
const fs = require("fs");
const { Graph, CliqueBuilder, CliqueSolver, CliqueMask } = require("../../js-server/graph.js");
const { GA } = require("../../js-server/gen_alg.js");
const zlib = require('zlib');

const clients = [];
let controllerSocket = null; // Socket da página pai
let expectedClients = 0;     // Quantos iframes a página pai disse que virão
let connectedCount = 0;      // Quantos iframes já se conectaram e deram "obs"
const readyClients = new Set();
let progressReport = { low: 0, medium: 0, high: 0, dense: 0 };

let activeGAs = {}; // Armazena as instâncias dos GAs: { "nome_do_dataset": instanciaGA }
let activeModels = {}; // Armazena os pesos da CNN: { "nome_dataset": { topology, weightsBase64, specs } }
let activeLoops = {}; // Armazena os IDs dos intervalos: { "vis-diff-context": intervalID }

let currentTrendSequence = [];
let trendInterval = null;
let lastTrendConfig = {};


const TREND_POP_SIZE = 15;

// --- MAPEAMENTO DO PROTOCOLO ---
const DIFFICULTY_MAP = {
    'low':    "gen200_p0.9_55.clq",
    'medium': "hamming10-4.clq",
    'high':   "C4000.5.clq",
    'dense':  "MANN_a45.clq",
    'medium2': "p_hat1500-3.clq"//"p_hat700-3.clq"
};

// --- LISTA DE DATASETS (Mantida conforme original) ---
const datasets = {
    "gen200_p0.9_55.clq": {
        name: "gen200_p0.9_55.clq",
        url: "../../../exemplosGrafos/gen200_p0.9_55.clq.txt",
        n_nodes: 200,
        n_links: 17910
    },
    "hamming10-4.clq": {
        name: "hamming10-4.clq",
        url: "../../../exemplosGrafos/hamming10-4.clq.txt",
        n_nodes: 1024,
        n_links: 434176
    },
    "C4000.5.clq": {
        name: "C4000.5.clq",
        url: "../../../exemplosGrafos/C4000.5.clq.txt",
        n_nodes: 4000,
        n_links: 4000268
    },
    "p_hat700-3.clq": {
        name: "p_hat700-3.clq",
        url: "../../../exemplosGrafos/clique62.txt",
        n_nodes: 700,
        n_links: 183010
    },
    "p_hat1500-3.clq": {
        name: "p_hat1500-3.clq",
        url: "../../../exemplosGrafos/clique94.txt",
        n_nodes: 1500,
        n_links: 847244
    },
    "MANN_a45.clq": {
        name: "MANN_a45.clq",
        url: "../../../exemplosGrafos/MANN_a45.clq.txt",
        n_nodes: 1035,
        n_links: 533115
    }
};

// Listas de distribuição (Multicast)
// Armazena arrays de sockets: { 'low': [ws1, ws2], 'medium': [ws3], ... }
const subscribers = {
    'low': {},
    'medium': {},
    'medium2': {},
    'high': {},
    'dense': {}
};

console.log("WebSocket server running on ws://localhost:3214");

// --- FUNÇÃO AUXILIAR PARA CARREGAR GA TEMPORÁRIO ---
// Carrega um grafo conforme o arquivo e mantem na memória.
function getOrLoadGA(datasetKey) {
    // 1. Se já existe na memória, retorna ele
    if (activeGAs[datasetKey]) {
        return activeGAs[datasetKey];
    }

    // 2. Se não existe, cria novo
    const datasetInfo = datasets[datasetKey];
    if (!datasetInfo) return null;

    try {
        let txt = fs.readFileSync(datasetInfo.url, { encoding: "utf-8" });
        let graph = new Graph();
        graph.importFromText(txt);
        graph.calcMatAdjs();

        let newGA = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);
        
        newGA.setParameters({
            populationSize: 25, 
            survivalRate: 0.01,
            mutationRate: 0.4,
            nodeIncludeProb: 0.01
        });
        
        newGA.init(); 

        // 3. Salva na memória global e retorna
        activeGAs[datasetKey] = newGA;
        return newGA;
    } catch (e) {
        console.error("Erro ao carregar GA:", e);
        return null;
    }
}

// --- SERVIDOR WEBSOCKET ---
server.on('connection', ws => {
    // console.log("Client connected");
    clients.push(ws);

    ws.on('message', async (message, isBinary) => {
        let obj;

        try {
            // VERIFICAÇÃO DE BINÁRIO (GZIP)
            if (isBinary) {
                // Descomprime para ler o conteúdo (síncrono para simplificar, ou use zlib.gunzipSync)
                const decompressed = zlib.gunzipSync(message); 
                obj = JSON.parse(decompressed.toString());
            } else {
                obj = JSON.parse(message);
            }
        } catch (e) {
            console.error("Erro ao processar mensagem (parse/zip):", e);
            return;
        }
        
        switch (obj.act) {

            // 1. PÁGINA PAI REGISTRA O EXPERIMENTO
            case "register_controller":
                controllerSocket = ws;
                expectedClients = obj.expected;

                // activeGAs = {}; // Limpa GAs antigos ao reiniciar o teste
                
                // Reseta estados para novo teste
                connectedCount = 0;
                readyClients.clear();
                Object.keys(subscribers).forEach(k => subscribers[k] = {});
                progressReport = { low: 0, medium: 0, high: 0, dense: 0 };
                
                console.log(`[CTRL] Controlador registrado. Aguardando ${expectedClients} visualizações.`);
                break;

            // 2. VISUALIZAÇÕES SE REGISTRAM (OBS)
            // O cliente envia: { act: "obs", data: ["medium"] }
            case "obs":
                const difficulty_obs = obj.data[0]; // Pega a string 'low', 'medium', etc.
                const id = obj.id || "unknown";
                const role = obj.context || "unknown";

                if (subscribers[difficulty_obs]) {
                    // Adiciona este socket à lista de inscritos daquela dificuldade
                    ws.role = role;
                    subscribers[difficulty_obs][id] = ws;

                    connectedCount++;
                    console.log(`[VIS] Cliente registrado para '${difficulty_obs}'. Total: ${connectedCount}/${expectedClients}`);

                    // SE TODOS ESTIVEREM CONECTADOS, INICIA O ENVIO DE DADOS
                    if (connectedCount === expectedClients) {
                        console.log("================= TODOS CONECTADOS. INICIANDO GERAÇÃO DE DADOS =================");
                        startDistributingData();
                    }
                }
                break;

            // 3. VISUALIZAÇÃO TERMINOU O TREINO
            case "visualization_ready":
                
                
                const clientID = obj.id || ws; 
                const clientDiff = clientID.split("-")[1];

                // if(obj.id) delete subscribers[clientDiff][obj.id]; // Remove da lista de inscritos
                if(obj.id) subscribers[clientDiff][obj.id].trainingCompleted = true; // Marca como completado

                // O Set garante que se o mesmo ID for adicionado 10 vezes, o tamanho continua 1
                if (!readyClients.has(clientID)) {
                    readyClients.add(clientID);

                    
                    if(progressReport[clientDiff] !== undefined) {
                        progressReport[clientDiff]++;
                    }

                    const currentCount = readyClients.size;
                    console.log(`[VIS] Cliente PRONTO. Progresso Real: ${currentCount}/${expectedClients}`);
                    console.log(`Validando Clientes conectados: ${clients.reduce((acc, curr) => {
                        return acc + (curr.readyState === WebSocket.OPEN ? 1 : 0);
                    }, 0)}`);

                    // console.log(`[VIS] PRONTO: ${clientDiff.toUpperCase()}. Progresso: ${currentCount}/${expectedClients}`);
                    console.log(`Resumo: Low ${progressReport.low}/20 | Med ${progressReport.medium}/20 | High ${progressReport.high}/20 | Dense ${progressReport.dense}/20`);


                    // Atualiza a barra de progresso do controlador
                    if (controllerSocket && controllerSocket.readyState === 1) {
                        controllerSocket.send(JSON.stringify({
                            act: "progress_update",
                            ready_count: currentCount,
                            ready: ""+clientID
                        }));
                    }

                    // Checa se acabou
                    if (currentCount >= expectedClients) {
                        console.log("=== TODOS OS SISTEMAS PRONTOS ===");
                        if (controllerSocket && controllerSocket.readyState === 1) {
                            controllerSocket.send(JSON.stringify({ act: "all_systems_go" }));
                        }
                    }
                } else {
                    // Log opcional para debug: ignorou duplicata
                    console.log("Ignorando sinal de pronto duplicado.");
                }
                break;

            // NOVO CASE: O HTML avisa que uma tarefa começou
            case "start_task":
                const { task, diff, context, vis, trendType } = obj; 
                console.log(`[CTRL] Iniciando Tarefa: ${task} | Dificuldade: ${diff} | Visualização: ${vis} | Contexto: ${context} | Cenario: ${trendType || 'N/A'}`);
                
                // Dispara o envio de dados específicos para essa dificuldade
                runTaskUpdate(task, diff, context, vis, trendType);
                break;


            // ... dentro do switch(obj.act) ...

            // 4. (NOVO) MESTRE ENVIA O MODELO TREINADO
            case "share_model":
                // Se chegou como binário (isBinary), já temos ele comprimido na variável 'message'.
                // Podemos salvar o binário compactado direto para economizar espaço!
                const { difficulty, artifacts } = obj.data;
                const datasetName = DIFFICULTY_MAP[difficulty];
                console.log(`[SERVER] Modelo recebido de ${obj.id}. Armazenando para distribuição.`);
                
               // Salva o objeto JSON descomprimido se precisar ler topology, 
                // MAS para retransmitir, o ideal é guardar o buffer compactado original 'message'.
                
                // Vamos salvar uma estrutura híbrida:
                activeModels[datasetName] = {
                    rawCompressed: isBinary ? message : null, // Guarda o blob GZIP original
                    artifacts: artifacts // Guarda descomprimido caso precise (opcional)
                };



                // Verifica se há clientes esperando por esse modelo (da mesma dificuldade)
                // Vamos varrer os subscribers dessa dificuldade e enviar
                // Retransmitir para os interessados
                // const diffKey = Object.keys(DIFFICULTY_MAP).find(key => DIFFICULTY_MAP[key] === datasetName);
                if (difficulty && subscribers[difficulty]) {

                    // 1. Descobre quem é a visualização e dificuldade remetente (ex: "cnn", "sketch")
                    const senderType = obj.id.slice(0, obj.id.lastIndexOf('-'));
                    
                    // 2. Itera sobre [ID, Socket] para poder filtrar pelo nome
                    Object.entries(subscribers[difficulty]).forEach(([clientId, clientSocket]) => {

                        // 3. Descobre quem é o destinatário
                        const clientType = clientId.slice(0, clientId.lastIndexOf('-'));

                        // LÓGICA DE FILTRO: 
                        // - Deve ser do mesmo tipo (cnn manda pra cnn)
                        // - Não pode ser o próprio remetente
                        // - Socket deve estar aberto
                        if (senderType === clientType && clientSocket !== ws && clientSocket.readyState === WebSocket.OPEN) {
                            
                            console.log(`[SERVER] Repassando modelo de ${obj.id} para ${clientId} (Par Compatível)`);
                            
                            if (activeModels[datasetName].rawCompressed) {
                                // Envia Binário Original
                                clientSocket.send(activeModels[datasetName].rawCompressed);
                            } else {
                                // Fallback Texto
                                clientSocket.send(JSON.stringify({
                                    act: "load_model",
                                    data: { artifacts: artifacts }
                                }));
                            }
                        }
                    });
                }
                break;

            // 5. (NOVO) ESCRAVO PEDE O MODELO (Caso tenha conectado atrasado)
            case "request_model":
                const reqDataset = DIFFICULTY_MAP[obj.data.difficulty]; // obj.data.difficulty = 'low', etc
                if (activeModels[reqDataset]) {
                    console.log(`[SERVER] Enviando modelo em cache para requisição tardia.`);
                    
                    if (activeModels[reqDataset].rawCompressed) {
                         // Envia o binário original em cache
                        ws.send(activeModels[reqDataset].rawCompressed);
                    } else {
                        // Fallback texto
                        ws.send(JSON.stringify({
                            act: "load_model",
                            data: { artifacts: activeModels[reqDataset].artifacts }
                        }));
                    }
                }
                break;

            case "stop_loop":
                // O controlador deve mandar os dados para sabermos quem parar
                // Ex: { act: "stop_loop", vis: "sketch", diff: "medium", context: "loop_sequence" }
                const loopKey = `${obj.vis}-${obj.diff}-${obj.context}`;
                
                if (activeLoops[loopKey]) {
                    clearInterval(activeLoops[loopKey]);
                    delete activeLoops[loopKey];
                    console.log(`[SERVER] Loop encerrado para: ${loopKey}`);
                }
                break;
             
            // 6. SALVAR RESULTADOS NO SERVIDOR (APPEND)
            case "save_results":
                console.log(`[SERVER] Recebendo dados do participante ${obj.data.participantID} para salvar.`);
                
                const resultsDir = "./analysis/results";
                const filePath = `${resultsDir}/pilot_results.json`;//`${resultsDir}/global_results.json`;

                try {
                    // 1. Garante que a pasta existe
                    if (!fs.existsSync(resultsDir)){
                        fs.mkdirSync(resultsDir);
                    }

                    // 2. Lê o arquivo atual (se existir)
                    let globalData = [];
                    if (fs.existsSync(filePath)) {
                        const fileContent = fs.readFileSync(filePath, 'utf8');
                        try {
                            globalData = JSON.parse(fileContent);
                        } catch (err) {
                            console.error("Erro ao ler JSON existente (pode estar corrompido). Criando novo array.");
                            globalData = [];
                        }
                    }

                    // 3. Garante que é um Array (para fazer append)
                    if (!Array.isArray(globalData)) {
                        globalData = [globalData];
                    }

                    // 4. Adiciona (Append) o novo dado
                    globalData.push(...(obj.data))

                    // 5. Salva no disco
                    fs.writeFileSync(filePath, JSON.stringify(globalData, null, 2));
                    console.log(`[SERVER] Dados salvos com sucesso em ${filePath}. Total participantes: ${globalData.length}`);

                    // 6. Confirma para o Cliente
                    ws.send(JSON.stringify({ act: "results_saved_success" }));

                } catch (error) {
                    console.error("Erro crítico ao salvar no servidor:", error);
                    ws.send(JSON.stringify({ act: "results_saved_error", error: error.message }));
                }
                break;

            case "start_trend_trial":
                // obj: { act, vis, trend, base }
                // Ex: trend="stagnation", base="medium2"
                lastTrendConfig = { diffKey: obj.base, vis: obj.vis }; 
                startTrendSequence(obj.trend, obj.base);
                break;

            case "req_replay":
                console.log("[SERVER] Replay solicitado.");
                playTrendSequence();
                break;
                
            // ... (Outros comandos like 'log' etc) ...
            case "log":
                console.log("[CLIENT LOG]", obj.data);
                break;
            
        }
    });
    
    // ... (on close logic) ...
     ws.on('close', () => {
        const idx = clients.indexOf(ws);
        if (idx > -1) clients.splice(idx, 1);
        if (connectedCount > 0) connectedCount--;
        console.log("Client disconnected");
    });
});

// --- LÓGICA DE GERAÇÃO E DISTRIBUIÇÃO ---
async function startDistributingData() {
    // Itera apenas pelas dificuldades que possuem inscritos
    console.log(Object.keys(subscribers));
    for (const [diffKey, socketArray] of Object.entries(subscribers)) {
        
        if (Object.keys(socketArray).length === 0){
            // Pula se ninguém pediu essa base
            console.log(">>>>>>>>>>> Nenhum cliente para dificuldade >>>>>>>> ", diffKey);
            continue;
        }  

        const datasetKey = DIFFICULTY_MAP[diffKey];
        const datasetInfo = datasets[datasetKey];

        if (!datasetInfo) {
            console.error(`ERRO: Dataset mapeado '${datasetKey}' não encontrado na lista.`);
            continue;
        }

        console.log(`>>> Gerando dados para '${diffKey}' (${datasetKey}). Enviando para ${Object.keys(socketArray).length} clientes.`);

        // 1. Carrega o GA específico
        const tempGA = getOrLoadGA(datasetKey);

        if (tempGA) {
            const NUM_BATCHES = 21;
            
            // 2. Loop de Envio (20 lotes de 25)
            for (let i = 0; i < NUM_BATCHES; i++) {
                
                const simplePopulation = tempGA.population.map(ind => ({
                    nodeMask: ind.nodeMask,
                    fitness: ind.fitness
                }));

                const payload = JSON.stringify({
                    act: "train",
                    data: {
                        population: simplePopulation,
                        generation: i,
                        datasetName: datasetKey // Opcional agora, pois o cliente já sabe o que pediu
                    }
                });

                // MULTICAST: Envia apenas para os interessados
                Object.values(socketArray)
                    .filter((socket)=>{return !socket.trainingCompleted})
                    .forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(payload);
                        }
                    });

                tempGA.nextGeneration();
                
                // Pequeno delay para não travar a thread do Node e dar respiro aos iframes
                await new Promise(r => setTimeout(r, 50));
            }
            console.log(`<<< Envio concluído para '${diffKey}'.`);
        }else{
            console.error(`ERRO: Não foi possível inicializar o GA para '${datasetKey}'.`);
        }
    }
}

let lastTask = null;
let lastTargetInd = null;
// Função para enviar dados durante a execução da tarefa
async function runTaskUpdate(task, diffKey, context, vis, trendType = null) {

    const datasetKey = DIFFICULTY_MAP[diffKey];
    const socketArray = subscribers[diffKey];
    
    // Pega o GA. O MELHOR indivíduo (índice 0) será sempre nossa REFERÊNCIA (Alvo)
    // Assumindo que o GA já ordenou a população por fitness.
    const currentGA = getOrLoadGA(datasetKey);

    // Identifica o cliente específico que pediu a tarefa
    const clientKey = `${vis}-${diffKey}-${context}`;
    const client = socketArray[clientKey];

    if (!client) {
        console.warn(`[WARN] Cliente não encontrado: ${clientKey}`);
        console.warn(`       Clientes disponíveis em '${diffKey}':`, Object.keys(socketArray));
        return;
    }

    if(lastTask!==task){
        lastTask = task;
        // Opcional: Avançar o GA para a próxima vez
        lastTargetInd = Math.floor(Math.random() * currentGA.population.length);
        currentGA.nextGeneration();
    }


    if (currentGA && client && client.readyState === WebSocket.OPEN) {
        
        
        const targetInd = {
            nodeMask: currentGA.population[lastTargetInd].nodeMask,
            fitness: currentGA.population[lastTargetInd].fitness
        };

        let payloadData = [];
        let targetPos = -1; // Armazena onde o alvo caiu (índice 0-based)

        // --- LÓGICA POR TAREFA (Protocolo) ---
        
        if (task === 'similarity') {
            // Protocolo: 1 Alvo vs 9 Candidatas (1 Correta, 8 Distratores) [cite: 155-162]
            
            if (context === 'target') {
                // Envia apenas a Referência
                payloadData = [targetInd];
            } 
            else if (context === 'candidates_grid') {
                // Gera 1 Correta (Jaccard 0.75 - 0.95)
                const correct = generateVariant(targetInd, 0.75, 0.95);
                
                // Gera 8 Distratores (Jaccard 0.25 - 0.50)
                const distractors = [];
                for(let i=0; i<8; i++) {
                    distractors.push(generateVariant(targetInd, 0.25, 0.50));
                }
                // 1. Embaralha somente os distratores
                shuffleArray(distractors);

                // 2. Define posição aleatória (0 a 8)
                targetPos = Math.floor(Math.random() * (distractors.length + 1));
                
                // 3. Insere o alvo na posição sorteada
                distractors.splice(targetPos, 0, correct);
                
                payloadData = distractors;
            }
        }

        else if (task === 'memory') {
            // Protocolo: Carrossel de 30 itens (5 telas x 6). 1 Alvo escondido. [cite: 166-173]
            
            if (context === 'target') {
                payloadData = [targetInd];
            } 
            else if (context === 'carousel_page') {
                // Fase de busca: Gera 8 distratores
                const memoryDistractors = [];
                for(let i=0; i<8; i++) {
                    memoryDistractors.push(generateVariant(targetInd, 0.25, 0.75));
                }
                
                // 1. Embaralha os distratores
                shuffleArray(memoryDistractors);
                
                // 2. Define posição do alvo (0 a 8)
                targetPos = Math.floor(Math.random() * 9); 
                
                // 3. Insere o alvo
                memoryDistractors.splice(targetPos, 0, targetInd);

                // Payload final: array de 9 itens
                payloadData = memoryDistractors;
            }
        }

        // ... dentro de runTaskUpdate ...
        
        else if (task === 'loop') {
            if (context === 'loop_sequence') {
                
                // 1. Define tamanho aleatório N entre 15 e 20 [cite: 180]
                const minSize = 5;
                const maxSize = 15;
                const loopSize = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;

                // 2. Gera a sequência de N imagens ÚNICAS (Novidade) [cite: 183]
                // A primeira é o alvo, as outras N-1 são variantes
                const sequence = [targetInd]; 
                for(let i=1; i<loopSize; i++) {
                    // Variantes com Jaccard variável para criar "movimento" mas serem distintas
                    sequence.push(generateVariant(targetInd, 0.3, 0.8));
                }

                // 3. Envia o GABARITO (Tamanho do Loop) para o Controlador [cite: 119]
                if (controllerSocket && controllerSocket.readyState === WebSocket.OPEN) {
                    console.log(`[CTRL] Gabarito Loop enviado. Tamanho: ${loopSize}`);
                    controllerSocket.send(JSON.stringify({
                        act: "answer_key",
                        task: task,
                        loopSize: loopSize // O HTML Pai usa isso para saber quando o loop começou
                    }));
                }

                // 4. INICIA O STREAMING (INTERVAL)
                // Limpa intervalo anterior se existir (segurança)
                if (activeLoops[clientKey]) clearInterval(activeLoops[clientKey]);

                let frameIndex = 0;

                // Configura o intervalo de 800ms 
                const sendLoopFrame = () => {
                    // Segurança: Se o cliente desconectou, para o loop
                    if (client.readyState !== WebSocket.OPEN) {
                        clearInterval(activeLoops[clientKey]);
                        delete activeLoops[clientKey];
                        return;
                    }

                    // Lógica Circular: Fase 1 (Novidade) -> Fase 2 (Repetição) [cite: 110, 114]
                    // O operador % faz o índice voltar a 0 quando chega em loopSize
                    const currentIndex = frameIndex % loopSize;
                    const currentInd = sequence[currentIndex];

                    const payload = JSON.stringify({
                        act: "data",
                        context: context,
                        data: {
                            population: [currentInd], // Envia array de 1 elemento
                            generation: currentGA.generation,
                            datasetName: datasetKey,
                            sequenceIndex: frameIndex // Útil para debug no front
                        }
                    });

                    client.send(payload);
                    frameIndex++;

                };

                // 3. EXECUTA IMEDIATAMENTE
                sendLoopFrame(); 

                // 4. Agenda os próximos para rodar a cada 800ms
                activeLoops[clientKey] = setInterval(sendLoopFrame, 800);

                // RETORNA AGORA para não executar o envio padrão no final da função
                return; 
            }
        }
        else if (task === 'trend') {
            
            // Limpa intervalos anteriores para não encavalar
            if (activeLoops[clientKey]) clearInterval(activeLoops[clientKey]);

            let step = 0; // Contador de gerações enviadas
            
            // Inicia o Intervalo de 1 segundo (1000ms)
            const sendTrendData = () => {
                
                // Segurança: Cliente desconectou?
                if (client.readyState !== WebSocket.OPEN) {
                    clearInterval(activeLoops[clientKey]);
                    delete activeLoops[clientKey];
                    return;
                }

                // 1. Calcula Intervalos Jaccard baseados no Cenário e no Passo
                let minJ, maxJ;

                if (trendType === 'convergence') {
                    // Começa: 0.3 - 0.4
                    // Desliza: +0.05 a cada passo
                    const slide = step * 0.05;
                    minJ = Math.min(0.95, 0.3 + slide); // Trava em 0.95 max
                    maxJ = Math.min(1.0,  0.4 + slide); // Trava em 1.0 max
                } 
                else if (trendType === 'divergence') {
                    // Começa: 0.8 - 0.9
                    // Desliza: -0.05 a cada passo
                    const slide = step * 0.05;
                    minJ = Math.max(0.0, 0.8 - slide); // Trava em 0.0 min
                    maxJ = Math.max(0.1, 0.9 - slide); // Trava em 0.1 min
                } 
                else {
                    // Aleatório (fallback ou 'random')
                    // Não define intervalo fixo aqui, faremos individualmente abaixo
                    minJ = 0; maxJ = 1;
                }

                // 2. Gera a População do Frame
                // O primeiro indivíduo pode ser o alvo para manter referência visual (opcional), 
                // ou geramos todos variantes. Vamos gerar todos variantes do alvo base.
                const trendPop = [];

                for(let i=0; i < TREND_POP_SIZE; i++) {
                    if (trendType === 'random') {
                        // Aleatório: Cada indivíduo tem um range Jaccard totalmente aleatório
                        // Isso cria o efeito de "ruído" total
                        const r1 = Math.random();
                        const r2 = Math.random();
                        const rndMin = Math.min(r1, r2);
                        const rndMax = Math.max(r1, r2);
                        trendPop.push(generateVariant(targetInd, rndMin, rndMax));
                    } else {
                        // Convergência/Divergência: Respeitam a janela deslizante calculada
                        trendPop.push(generateVariant(targetInd, minJ, maxJ));
                    }
                }

                // 3. Envia o Pacote
                const payload = JSON.stringify({
                    act: "data",
                    context: context,
                    data: {
                        population: trendPop, // Array de 15 indivíduos
                        generation: step,     // Para o front saber o progresso
                        datasetName: datasetKey,
                        trendInfo: { type: trendType, step: step, range: [minJ, maxJ] } // Meta-dados úteis
                    }
                });

                client.send(payload);
                step++;

                // Opcional: Parar automaticamente após X segundos para economizar server?
                // O front já mata o iframe em 10s. Vamos colocar 15s de segurança.
                if (step > 15) {
                    clearInterval(activeLoops[clientKey]);
                }

            };
        
            // 2. EXECUTA IMEDIATAMENTE (T=0)
            // Isso garante que o iframe tenha dados novos ANTES de ficar visível (no delay de 1s do front)
            sendTrendData();

            // 3. Agenda os próximos (T=1s, T=2s...)
            activeLoops[clientKey] = setInterval(sendTrendData, 1000);

            return; // Retorna para não executar o envio padrão abaixo
        }
        else {
            // Fallback para debug
            payloadData = [targetInd];
        }

        // --- ENVIO DA RESPOSTA PARA O HTML PAI (CONTROLADOR) ---
        // Se calculamos uma posição válida, avisamos o controlador
        if (targetPos !== -1 && controllerSocket && controllerSocket.readyState === WebSocket.OPEN) {
            console.log(`[CTRL] Gabarito enviado. Tarefa: ${task} | Alvo no índice: ${targetPos}`);
            controllerSocket.send(JSON.stringify({
                act: "answer_key",
                task: task,
                correctIndex: targetPos + 1 // +1 pois seus botões no HTML são 1-9, não 0-8
            }));
        }

        // ENVIO
        const payload = JSON.stringify({
            act: "data",
            context: context,
            data: {
                population: payloadData, // O iframe vai renderizar isso
                generation: currentGA.generation,
                datasetName: datasetKey
            }
        });

        client.send(payload);
    }
}


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


// --- UTILITÁRIOS DO PROTOCOLO ---

// Calcula Similaridade de Jaccard entre duas máscaras binárias
function calculateJaccard(maskA, maskB) {
    let intersection = 0;
    let union = 0;
    for (let i = 0; i < maskA.length; i++) {
        if (maskA[i] === 1 && maskB[i] === 1) intersection++;
        if (maskA[i] === 1 || maskB[i] === 1) union++;
    }
    return union === 0 ? 0 : intersection / union;
}
// Calcula quantos pares de bits (1->0 e 0->1) precisam ser trocados 
// para atingir um Jaccard alvo aproximado.
function getSwapCountForJaccard(totalOnes, targetJaccard) {
    if (targetJaccard >= 1.0) return 0;
    if (targetJaccard <= 0.0) return totalOnes; // Troca tudo
    
    // Fórmula derivada: k = N * (1 - J) / (1 + J)
    return Math.round(totalOnes * (1 - targetJaccard) / (1 + targetJaccard));
}

// Gera variante baseada na média de swaps necessários para o range
function generateVariant(baseInd, minJaccard, maxJaccard) {
    const mask = [...baseInd.nodeMask];
    
    // Mapeia índices onde temos 1s e 0s
    const onesIndices = [];
    const zerosIndices = [];
    for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 1) onesIndices.push(i);
        else zerosIndices.push(i);
    }
    
    const N = onesIndices.length;

    // 1. Calcula swaps necessários para os limites
    // Nota: Jaccard MAIOR requer MENOS swaps. Jaccard MENOR requer MAIS swaps.
    const minSwaps = getSwapCountForJaccard(N, maxJaccard); // Para atingir o máximo (ex: 0.95), muda pouco
    const maxSwaps = getSwapCountForJaccard(N, minJaccard); // Para atingir o mínimo (ex: 0.75), muda muito
    
    // 2. Define a meta (Média)
    const targetSwaps = Math.floor((minSwaps + maxSwaps) / 2);
    
    // Limite de segurança (não podemos trocar mais do que temos disponível)
    const actualSwaps = Math.min(targetSwaps, onesIndices.length, zerosIndices.length);

    // 3. Executa os Swaps (Aleatório sem verificação de colisão)
    // Embaralha os índices para garantir aleatoriedade na escolha de quais bits trocar
    shuffleArray(onesIndices);
    shuffleArray(zerosIndices);

    for (let i = 0; i < actualSwaps; i++) {
        const idxOne = onesIndices[i];
        const idxZero = zerosIndices[i];
        
        // Swap
        mask[idxOne] = 0;
        mask[idxZero] = 1;
    }

    // 4. Verificação e Notificação (apenas log)
    const actualJaccard = calculateJaccard(baseInd.nodeMask, mask);
    
    if (actualJaccard < minJaccard || actualJaccard > maxJaccard) {
        console.log(`[WARN] Jaccard fora do range! Range: [${minJaccard}-${maxJaccard}] | Real: ${actualJaccard.toFixed(3)} | Swaps realizados: ${actualSwaps}`);
    }

    return {
        nodeMask: mask,
        fitness: baseInd.fitness * actualJaccard, // Fitness simulado
        isGenerated: true
    };
}

// ==========================================
// LÓGICA DE GERAÇÃO DE TENDÊNCIA (USANDO JACCARD/GENERATE VARIANT)
// ==========================================

function startTrendSequence(trendType, diffKey) {
    const datasetKey = DIFFICULTY_MAP[diffKey];
    const ga = getOrLoadGA(datasetKey);
    
    // Validação de segurança
    if (!ga || !ga.population || ga.population.length === 0) {
        console.error(`[ERROR] GA não pronto para ${datasetKey}`);
        return;
    }

    // Seleciona indivíduo base aleatório
    const baseInd = ga.population[Math.floor(Math.random() * ga.population.length)]; 
    currentTrendSequence = [];

    const TOTAL_FRAMES = 30;
    // Usa a constante global se definida, senão 15
    const POP_SIZE = (typeof TREND_POP_SIZE !== 'undefined') ? TREND_POP_SIZE : 15;

    console.log(`[TREND] Gerando sequência (Jaccard Controlado): ${trendType} para ${diffKey}`);

    for (let f = 0; f < TOTAL_FRAMES; f++) {
        let framePop = [];
        // Progresso da animação de 0.0 a 1.0
        const progress = f / (TOTAL_FRAMES - 1);

        // Define a meta de Similaridade (Jaccard) para este quadro específico
        let targetJaccard = 0;

        if (trendType === 'stagnation') {
            // ESTAGNAÇÃO: Mantém uma similaridade alta e fixa (pouca variação).
            // Fixamos em ~0.8 (80% igual). Isso gera aquela "vibração" local sem sair do lugar.
            targetJaccard = 0.8;
        } 
        else if (trendType === 'convergence') {
            // CONVERGÊNCIA: Começa longe (ex: 0.2) e termina no alvo (0.8)
            const startJ = 0.2;
            const endJ = 0.8;
            // Interpolação Linear
            targetJaccard = startJ + (endJ - startJ) * progress;
        }
        else if (trendType === 'divergence') {
            // DIVERGÊNCIA: Começa no alvo (0.8) e termina longe (ex: 0.2)
            const startJ = 0.8;
            const endJ = 0.2;
            targetJaccard = startJ + (endJ - startJ) * progress;
        }
        else if (trendType === 'random') {
            // ALEATÓRIO: Todos os quadros têm similaridade baixa e fixa (ex: 0.2)
            targetJaccard = 0.2;
        }

        // Gera a população do quadro usando generateVariant
        for (let i = 0; i < POP_SIZE; i++) {
            // Usa a função existente do sistema para criar variantes com Jaccard preciso
            // Passamos min e max iguais para travar a distância exata naquele frame
            
            // Nota: Math.min(..., 1.0) garante que não passamos de 100%
            let safeJaccard = Math.min(targetJaccard, 1.0);
            
            // generateVariant(indBase, minJaccard, maxJaccard)
            const variant = generateVariant(baseInd, safeJaccard-0.05, safeJaccard+0.05);
            framePop.push(variant);
        }

        currentTrendSequence.push({
            act: "data",
            data:{
                generation: f,
                population: framePop
            }
        });
    }
    ga.nextGeneration(); // Avança o GA para a próxima geração.
    // Inicia a reprodução
    playTrendSequence();
}

function playTrendSequence() {
    if (trendInterval) clearInterval(trendInterval);
    
    let frameIdx = 0;
    const { diffKey, vis } = lastTrendConfig;

    // Intervalo de 250ms (lento para facilitar percepção)
    trendInterval = setInterval(() => {
        if (frameIdx >= currentTrendSequence.length) {
            clearInterval(trendInterval);
            // Avisa o controlador que acabou (para liberar botões)
            if (controllerSocket && controllerSocket.readyState === WebSocket.OPEN) {
                controllerSocket.send(JSON.stringify({ act: "animation_ended" }));
            }
            return;
        }

        const frame = currentTrendSequence[frameIdx];
        
        // Envia para todos os clientes daquela dificuldade (ex: 'medium2')
        const subscribersList = subscribers[diffKey];
        if (subscribersList) {
            const client = subscribersList[`${vis}-${diffKey}-target`];
            // Object.values(subscribersList).forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(frame));
            }
            // });
        }

        frameIdx++;
    }, 100);
}