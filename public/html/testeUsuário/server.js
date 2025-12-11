const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });
const fs = require("fs");
const { Graph, CliqueBuilder, CliqueSolver, CliqueMask } = require("../../js-server/graph.js");
const { GA } = require("../../js-server/gen_alg.js");

const clients = [];
let controllerSocket = null; // Socket da página pai
let expectedClients = 0;     // Quantos iframes a página pai disse que virão
let connectedCount = 0;      // Quantos iframes já se conectaram e deram "obs"
const readyClients = new Set();
const progressReport = { low: 0, medium: 0, high: 0, dense: 0 };

let activeGAs = {}; // Armazena as instâncias dos GAs: { "nome_do_dataset": instanciaGA }

// --- MAPEAMENTO DO PROTOCOLO ---
const DIFFICULTY_MAP = {
    'low':    "gen200_p0.9_55.clq",
    'medium': "hamming10-4.clq",
    'high':   "C4000.5.clq",
    'dense':  "MANN_a45.clq"
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
            survivalRate: 0.1,
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

    ws.on('message', async (message) => {
        const obj = JSON.parse(message);

        switch (obj.act) {

            // 1. PÁGINA PAI REGISTRA O EXPERIMENTO
            case "register_controller":
                controllerSocket = ws;
                expectedClients = obj.expected;

                // activeGAs = {}; // Limpa GAs antigos ao reiniciar o teste
                
                // Reseta estados para novo teste
                connectedCount = 0;
                readyClients.clear();
                Object.keys(subscribers).forEach(k => subscribers[k] = []);
                
                console.log(`[CTRL] Controlador registrado. Aguardando ${expectedClients} visualizações.`);
                break;

            // 2. VISUALIZAÇÕES SE REGISTRAM (OBS)
            // O cliente envia: { act: "obs", data: ["medium"] }
            case "obs":
                const difficulty = obj.data[0]; // Pega a string 'low', 'medium', etc.
                const id = obj.id || "unknown";
                const role = obj.context || "unknown";

                if (subscribers[difficulty]) {
                    // Adiciona este socket à lista de inscritos daquela dificuldade
                    ws.role = role;
                    subscribers[difficulty][id] = ws;

                    connectedCount++;
                    console.log(`[VIS] Cliente registrado para '${difficulty}'. Total: ${connectedCount}/${expectedClients}`);

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
                const { task, diff, context, vis } = obj; 
                console.log(`[CTRL] Iniciando Tarefa: ${task} | Dificuldade: ${diff} | Visualização: ${vis} | Contexto: ${context}`);
                
                // Dispara o envio de dados específicos para essa dificuldade
                runTaskUpdate(task, diff, context, vis);
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

// Função para enviar dados durante a execução da tarefa
async function runTaskUpdate(task, diffKey, context, vis) {
    const datasetKey = DIFFICULTY_MAP[diffKey];
    const socketArray = subscribers[diffKey];
    
    // Recupera o GA que já está na memória
    const currentGA = getOrLoadGA(datasetKey);

    if (currentGA && socketArray) {
        // Envia apenas 1 geração (ou ajuste conforme necessário) para atualizar os iframes
        const simplePopulation = currentGA.population.map(ind => ({
            nodeMask: ind.nodeMask,
            fitness: ind.fitness
        }));

        // const payload = JSON.stringify({
        //     act: "data", // Ou 'train', dependendo de como seu iframe espera receber
        //     mode: "update",
        //     data: {
        //         population: simplePopulation,
        //         generation: currentGA.generation,
        //         datasetName: datasetKey
        //     }
        // });
        console.log(`${vis}-${diffKey}-${context}`);
        const client = socketArray[`${vis}-${diffKey}-${context}`];
        // Envia para todos os inscritos daquela dificuldade
        // Object.values(socketArray).forEach(client => {
            shuffleArray(simplePopulation);
            if (client.readyState === WebSocket.OPEN) {
                let specificData = [];
                const role = client.role;

                // --- LÓGICA DE QUANTIDADE POR CONTEXTO ---
                if (role === 'target') {
                    // Envia apenas o 1º indivíduo (o melhor, se estiver ordenado, ou aleatório)
                    specificData = simplePopulation.slice(0, 1); 
                } 
                else if (role === 'candidates_grid') {
                    // Envia 9 indivíduos
                    specificData = simplePopulation.slice(0, 9);
                } 
                else if (role === 'carousel_page') {
                    // Exemplo: Memória usa 6 itens
                    specificData = simplePopulation.slice(0, 6);
                }
                else if (role === 'loop_sequence') {
                    // Exemplo: Loop usa 1 item animado
                    specificData = simplePopulation.slice(0, 1);
                }
                else {
                    // Fallback: Envia tudo ou um padrão seguro
                    specificData = simplePopulation.slice(0, 9);
                }

                // Monta e envia o pacote
                const payload = JSON.stringify({
                    act: "data",
                    context: role, // Útil para debug no client
                    data: {
                        population: specificData,
                        generation: currentGA.generation,
                        datasetName: datasetKey
                    }
                });

                client.send(payload);
            }
        // });

        // Opcional: Avançar o GA para a próxima vez
        currentGA.nextGeneration();
    }
}


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}