const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214, maxPayload: 500 * 1024 * 1024 });
const fs = require("fs");
const { Graph, CliqueMask } = require("../../js-server/graph.js");
const { GA } = require("../../js-server/gen_alg.js");
const zlib = require('zlib');

// ==========================================
// CONFIGURAÇÃO DO CENÁRIO
// ==========================================
// 'A' = Density Spectrum (0%, 10%, 50%, 90%, 100%)
// 'B' = Similarity Spectrum (Target, v9, v7, v5, v3, v1)
const ACTIVE_SCENARIO = 'A'; 

const SCENARIO_CONFIG = {
    'A': {
        bits: 1000,
        datasetName: "density_test"
    },
    'B': {
        datasetFile: "p_hat1500-3.clq",
        datasetPath: "../../../exemplosGrafos/clique94.txt", 
        n_nodes: 1500
    }
};

// CACHE GLOBAL PARA DADOS FINAIS (Não usado no treino)
let cachedScenarioData = null;

console.log(`=================================================`);
console.log(` SERVER FIG GENERATOR (Final w/ Cache)`);
console.log(` CENÁRIO ATIVO: [ ${ACTIVE_SCENARIO} ]`);
console.log(` Aguardando conexões...`);
console.log(`=================================================`);

server.on('connection', ws => {
    console.log(`[NOVO] Cliente conectado.`);

    ws.isTraining = true;
    
    // Se for cenário B, carrega GA para treino deste cliente
    if (ACTIVE_SCENARIO === 'B') {
        const cfg = SCENARIO_CONFIG['B'];
        ws.gaInstance = loadGA(cfg.datasetPath, cfg.n_nodes);
        if (!ws.gaInstance) {
            console.error("Erro ao carregar GA. Verifique caminhos.");
            ws.close();
            return;
        }
    }

    // Inicia Loop de Treino (Sem cache, individual por cliente)
    runTrainingLoop(ws).catch(err => console.error("Erro treino:", err));

    ws.on('message', async (message, isBinary) => {
        let obj;
        try {
            if (isBinary) {
                const decompressed = zlib.gunzipSync(message);
                obj = JSON.parse(decompressed.toString());
            } else {
                obj = JSON.parse(message);
            }
        } catch (e) { return; }

        switch (obj.act) {
            case "visualization_ready":
                if (ws.isTraining) {
                    console.log(`[PRONTO] Cliente finalizou treino. Solicitando DADOS FINAIS...`);
                    ws.isTraining = false; 
                    
                    // Delay para garantir sincronia de encerramento do loop
                    setTimeout(() => sendScenarioData(ws), 100);
                }
                break;
            // Ignora outros comandos
        }
    });

    ws.on('close', () => { ws.isTraining = false; });
});

// ==========================================
// 1. ROTINA DE TREINO (Contínua, Individual)
// ==========================================
async function runTrainingLoop(ws) {
    let gen = 0;
    while (ws.isTraining && ws.readyState === WebSocket.OPEN) {
        
        let payload = null;

        if (ACTIVE_SCENARIO === 'A') {
            const cfg = SCENARIO_CONFIG['A'];
            const pop = [];
            for(let k=0; k < 25; k++) pop.push(generateRandomIndividual(cfg.bits, 0.5));
            
            payload = { population: pop, generation: gen, datasetName: cfg.datasetName };

        } else {
            const cfg = SCENARIO_CONFIG['B'];
            const ga = ws.gaInstance;
            const pop = ga.population.map(ind => ({ nodeMask: ind.nodeMask, fitness: ind.fitness }));
            
            payload = { population: pop, generation: gen, datasetName: cfg.datasetFile };
            ga.nextGeneration();
        }

        ws.send(JSON.stringify({ act: "train", data: payload }));
        gen++;
        await sleep(50);
    }
}

// ==========================================
// 2. ROTINA DE DADOS (Única, Cacheada)
// ==========================================
function sendScenarioData(ws) {
    if (ws.readyState !== WebSocket.OPEN) return;

    // 1. VERIFICA CACHE
    if (cachedScenarioData) {
        console.log(`[CACHE] Enviando dados já gerados para o cliente.`);
        ws.send(JSON.stringify({
            act: "data",
            data: cachedScenarioData
        }));
        return;
    }

    // 2. GERA DADOS (Se cache estiver vazio)
    console.log(`[GERANDO] Criando dados únicos para o Cenário ${ACTIVE_SCENARIO}...`);
    
    let finalPop = [];
    let dName = "";

    if (ACTIVE_SCENARIO === 'A') {
        const cfg = SCENARIO_CONFIG['A'];
        dName = cfg.datasetName;
        // Espectro de Densidade
        const densities = [0.0, 0.1, 0.5, 0.9, 1.0];
        finalPop = densities.map(d => generateRandomIndividual(cfg.bits, d));

    } else {
        const cfg = SCENARIO_CONFIG['B'];
        dName = cfg.datasetFile;
        // Usa o GA do cliente atual para definir a "Verdade" (Target)
        const ga = ws.gaInstance; 
        const targetInd = ga.population[0];
        const targetSimple = { nodeMask: targetInd.nodeMask, fitness: targetInd.fitness };

        // Variantes de Similaridade (Target + v9, v7, v5, v3, v1)
        const v9 = generateVariant(targetSimple, 0.9, 0.95);
        const v7 = generateVariant(targetSimple, 0.7, 0.75);
        const v5 = generateVariant(targetSimple, 0.5, 0.55);
        const v3 = generateVariant(targetSimple, 0.3, 0.35);
        const v1 = generateVariant(targetSimple, 0.1, 0.15);

        finalPop = [targetSimple, v9, v7, v5, v3, v1];
    }

    // 3. SALVA NO CACHE
    cachedScenarioData = {
        population: finalPop,
        generation: 999,
        datasetName: dName
    };

    // 4. ENVIA
    ws.send(JSON.stringify({
        act: "data",
        data: cachedScenarioData
    }));
    console.log(`[SUCESSO] Dados gerados e cacheados.`);
}


// ==========================================
// UTILITÁRIOS
// ==========================================
function loadGA(path, n_nodes) {
    try {
        let txt = fs.readFileSync(path, { encoding: "utf-8" });
        let graph = new Graph();
        graph.importFromText(txt);
        graph.calcMatAdjs();
        let newGA = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);
        newGA.setParameters({ populationSize: 25, survivalRate: 0.01, mutationRate: 0.1, nodeIncludeProb: 0.05 });
        newGA.init(); 
        return newGA;
    } catch (e) { console.error(e); return null; }
}

function generateRandomIndividual(bits, density) {
    const mask = new Array(bits).fill(0);
    const targetOnes = Math.floor(bits * density);
    for(let i=0; i<targetOnes; i++) mask[i] = 1;
    shuffleArray(mask);
    return { nodeMask: mask, fitness: density }; 
}

function getSwapCountForJaccard(totalOnes, targetJaccard) {
    if (targetJaccard >= 1.0) return 0;
    if (targetJaccard <= 0.0) return totalOnes;
    return Math.round(totalOnes * (1 - targetJaccard) / (1 + targetJaccard));
}

function generateVariant(baseInd, minJ, maxJ) {
    const mask = [...baseInd.nodeMask];
    const onesIndices = [], zerosIndices = [];
    mask.forEach((bit, i) => bit === 1 ? onesIndices.push(i) : zerosIndices.push(i));
    
    const N = onesIndices.length;
    const minSwaps = getSwapCountForJaccard(N, maxJ); 
    const maxSwaps = getSwapCountForJaccard(N, minJ); 
    const targetSwaps = Math.floor((minSwaps + maxSwaps) / 2);
    const actualSwaps = Math.min(targetSwaps, onesIndices.length, zerosIndices.length);

    shuffleArray(onesIndices);
    shuffleArray(zerosIndices);

    for (let i = 0; i < actualSwaps; i++) {
        mask[onesIndices[i]] = 0;
        mask[zerosIndices[i]] = 1;
    }
    return { nodeMask: mask, fitness: baseInd.fitness * ((minJ+maxJ)/2) };
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }