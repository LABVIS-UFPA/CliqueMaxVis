const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });

const { TreeSaveModel } = require("./js-server/TreeSaveModel.js");
const clients = [];
const Logger = require("./js-server/logger.js");
let logger;
const zlib = require('zlib');


const observers = {
    obs_fitness: [],
    obs_individuals: [],
    obs_best_individuals: [],
    obs_running: [],
    obs_timings: [],
    obs_parameters: [],
    obs_ui_events: []
};

const datasets = {
    "keller6.clq": {
        name: "keller6.clq",
        url: "../exemplosGrafos/keller6.clq.txt",
        n_nodes: 3361,
        n_links: 4619898
    },
    "keller5.clq": {
        name: "keller5.clq",
        url: "../exemplosGrafos/keller5.clq.txt",
        n_nodes: 776,
        n_links: 225990
    },
    "keller4.clq": {
        name: "keller4.clq",
        url: "../exemplosGrafos/keller4.clq.txt",
        n_nodes: 171,
        n_links: 9435
    },
    "hamming8-4.clq": {
        name: "hamming8-4.clq",
        url: "../exemplosGrafos/hamming8-4.clq.txt",
        n_nodes: 256,
        n_links: 20864
    },
    "hamming10-4.clq": {
        name: "hamming10-4.clq",
        url: "../exemplosGrafos/hamming10-4.clq.txt",
        n_nodes: 1024,
        n_links: 434176
    },
    "gen400_p0.9_75.clq": {
        name: "gen400_p0.9_75.clq",
        url: "../exemplosGrafos/gen400_p0.9_75.clq.txt",
        n_nodes: 400,
        n_links: 71820
    },
    "gen400_p0.9_65.clq": {
        name: "gen400_p0.9_65.clq",
        url: "../exemplosGrafos/gen400_p0.9_65.clq.txt",
        n_nodes: 400,
        n_links: 71820
    },
    "gen400_p0.9_55.clq": {
        name: "gen400_p0.9_55.clq",
        url: "../exemplosGrafos/gen400_p0.9_55.clq.txt",
        n_nodes: 400,
        n_links: 71820
    },
    "gen200_p0.9_55.clq": {
        name: "gen200_p0.9_55.clq",
        url: "../exemplosGrafos/gen200_p0.9_55.clq.txt",
        n_nodes: 200,
        n_links: 17910
    },
    "gen200_p0.9_44.clq": {
        name: "gen200_p0.9_44.clq",
        url: "../exemplosGrafos/gen200_p0.9_44.clq.txt",
        n_nodes: 200,
        n_links: 17910
    },
    "brock800_4.clq": {
        name: "brock800_4.clq",
        url: "../exemplosGrafos/brock800_4.clq.txt",
        n_nodes: 800,
        n_links: 207643
    },
    "brock800_2.clq": {
        name: "brock800_2.clq",
        url: "../exemplosGrafos/brock800_2.clq.txt",
        n_nodes: 800,
        n_links: 208166
    },
    "brock400_4.clq": {
        name: "brock400_4.clq",
        url: "../exemplosGrafos/brock400_4.clq.txt",
        n_nodes: 400,
        n_links: 59765
    },
    "brock400_2.clq": {
        name: "brock400_2.clq",
        url: "../exemplosGrafos/brock400_2.clq.txt",
        n_nodes: 400,
        n_links: 59786
    },
    "brock200_4.clq": {
        name: "brock200_4.clq",
        url: "../exemplosGrafos/brock200_4.clq.txt",
        n_nodes: 200,
        n_links: 13089
    },
    "brock200_2.clq": {
        name: "brock200_2.clq",
        url: "../exemplosGrafos/brock200_2.clq.txt",
        n_nodes: 200,
        n_links: 9876
    },
    "MANN_a81.clq": {
        name: "MANN_a81.clq",
        url: "../exemplosGrafos/MANN_a81.clq.txt",
        n_nodes: 3321,
        n_links: 5506380
    },
    "MANN_a45.clq": {
        name: "MANN_a45.clq",
        url: "../exemplosGrafos/MANN_a45.clq.txt",
        n_nodes: 1035,
        n_links: 533115
    },
    "MANN_a27.clq": {
        name: "MANN_a27.clq",
        url: "../exemplosGrafos/MANN_a27.clq.txt",
        n_nodes: 378,
        n_links: 70551
    },
    "DSJC1000_5.clq": {
        name: "DSJC1000_5.clq",
        url: "../exemplosGrafos/DSJC1000_5.clq.txt",
        n_nodes: 1000,
        n_links: 499652
    },
    "DSJC500_5.clq": {
        name: "DSJC500_5.clq",
        url: "../exemplosGrafos/DSJC500_5.clq.txt",
        n_nodes: 500,
        n_links: 125248
    },
    "C4000.5.clq": {
        name: "C4000.5.clq",
        url: "../exemplosGrafos/C4000.5.clq.txt",
        n_nodes: 4000,
        n_links: 4000268
    },
    "C2000.5.clq": {
        name: "C2000.5.clq",
        url: "../exemplosGrafos/C2000.5.clq.txt",
        n_nodes: 2000,
        n_links: 999836
    },
    "C2000.9.clq": {
        name: "C2000.9.clq",
        url: "../exemplosGrafos/C2000.9.clq.txt",
        n_nodes: 2000,
        n_links: 1799532
    },
    "C1000.9.clq": {
        name: "C1000.9.clq",
        url: "../exemplosGrafos/C1000.9.clq.txt",
        n_nodes: 1000,
        n_links: 450079
    },
    "C500.9.clq": {
        name: "C500.9.clq",
        url: "../exemplosGrafos/C500.9.clq.txt",
        n_nodes: 500,
        n_links: 112332
    },
    "C250.9.clq": {
        name: "C250.9.clq",
        url: "../exemplosGrafos/clique44.txt",
        n_nodes: 250,
        n_links: 27984
    },
    "C125.9.clq": {
        name: "C125.9.clq",
        url: "../exemplosGrafos/clique34.txt",
        n_nodes: 150,
        n_links: 6963
    },
    "p_hat1500-2.clq": {
        name: "p_hat1500-2.clq",
        url: "../exemplosGrafos/clique65.txt",
        n_nodes: 1500,
        n_links: 568960
    },
    "p_hat1500-3.clq": {
        name: "p_hat1500-3.clq",
        url: "../exemplosGrafos/clique94.txt",
        n_nodes: 1500,
        n_links: 847244
    },
    "p_hat700-3.clq": {
        name: "p_hat700-3.clq",
        url: "../exemplosGrafos/clique62.txt",
        n_nodes: 700,
        n_links: 183010
    },
    "p_hat300-1.clq": {
        name: "p_hat300-1.clq",
        url: "../exemplosGrafos/p_hat300-1.clq.txt",
        n_nodes: 300,
        n_links: 10933
    },
    "p_hat300-2.clq": {
        name: "p_hat300-2.clq",
        url: "../exemplosGrafos/p_hat300-2.clq.txt",
        n_nodes: 300,
        n_links: 21928
    },
    "p_hat300-3.clq": {
        name: "p_hat300-3.clq",
        url: "../exemplosGrafos/p_hat300-3.clq.txt",
        n_nodes: 300,
        n_links: 33390
    },
    "p_hat700-1.clq": {
        name: "p_hat700-1.clq",
        url: "../exemplosGrafos/p_hat700-1.clq.txt",
        n_nodes: 700,
        n_links: 60999
    },
    "p_hat700-2.clq": {
        name: "p_hat700-2.clq",
        url: "../exemplosGrafos/p_hat700-2.clq.txt",
        n_nodes: 700,
        n_links: 121728
    },
    "p_hat1500-1.clq": {
        name: "p_hat1500-1.clq",
        url: "../exemplosGrafos/p_hat1500-1.clq.txt",
        n_nodes: 1500,
        n_links: 284923
    },
}

let currentSave;


let partialReset = false;

let isRunning = false;
let runSingleStep = false;
let executionSpeed = 50;
let localBest = 0;
let newSolutionAvailable = false; // Variável para armazenar o estado da notificação



console.log("WebSocket server running on ws://localhost:3214");


const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, '')));
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});






require('node:child_process')
    .exec('start http://127.0.0.1:3000/html/dashboard.html');





const fs = require("fs");
const { Graph, CliqueBuilder, CliqueSolver, CliqueMask } = require("./js-server/graph.js");
const { GA, GRASP } = require("./js-server/gen_alg.js");
let ga;
let lastCpuUsage;
let lastHrTime;
let treeModel;


// --- Conexão com o Servidor Central ---
let CENTRAL_SERVER_URL; // Não mais fixo
const CENTRAL_SERVER_PORT = 41235; // Porta fixa
let centralSocket;

function connectToCentralServer() {
    if (!CENTRAL_SERVER_URL) {
        console.log("URL do servidor central não definida. Conexão não iniciada.");
        const msg = JSON.stringify({ act: 'central_status', data: { status: 'disconnected', message: 'URL do servidor não definida.' } });
        for (const c of observers.obs_ui_events) { c.send(msg); }
        return;
    }

    const connectingMsg = JSON.stringify({ act: 'central_status', data: { status: 'connecting', message: `Conectando a ${CENTRAL_SERVER_URL}...` } });
    for (const c of observers.obs_ui_events) { c.send(connectingMsg); }

    centralSocket = new WebSocket(CENTRAL_SERVER_URL);

    centralSocket.on('open', () => {
        const msg = JSON.stringify({ act: 'central_status', data: { status: 'connected', message: 'Conectado ao servidor central.' } });
        for (const c of observers.obs_ui_events) { c.send(msg); }

        console.log('Conectado ao servidor central.');
        reconnectionAttempt = 1; // Reseta a contagem de tentativas ao conectar
        syncWithCentralServer(); // Sincroniza todos os melhores resultados locais com o servidor central
    });

    centralSocket.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'new_network_solution') {
                const { datasetName, bestFitness, user, individual } = data.payload; // individual contém {metaheuristic, user, nodeMask}

                // Descomprime o nodeMask recebido da rede
                const decompressedNodeMask = zlib.gunzipSync(Buffer.from(individual.nodeMask, 'base64')).toString().split('').map(bit => parseInt(bit));
                const decompressedIndividual = { ...individual, nodeMask: decompressedNodeMask };

                console.log(`Solução da rede recebida: Usuário ${user} atingiu ${bestFitness} no dataset ${datasetName}`);

                const isNewFitnessRecord = saveNetworkBest(datasetName, bestFitness, individual);

                // Notifica o dashboard APENAS se for um novo recorde de fitness
                if (isNewFitnessRecord) {
                    newSolutionAvailable = true; // Define que há uma nova solução
                    clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify({
                                act: 'global_best_notification',
                                data: { user, fitness: bestFitness, datasetName }
                            }));
                            // Envia notificação para mostrar o indicador de nova solução
                            client.send(JSON.stringify({
                                act: 'new_solution_indicator',
                                data: { show: true }
                            }));
                        }
                    });
                }
            }
        } catch (e) {
            console.error("Erro ao processar mensagem do servidor central:", e);
        }
    });

    centralSocket.on('close', () => {
        const delay = 5000 * Math.pow(2, reconnectionAttempt - 1);
        console.log(`Desconectado do servidor central. Tentativa ${reconnectionAttempt}. Tentando reconectar em ${delay / 1000} segundos...`);

        const msg = JSON.stringify({ act: 'central_status', data: { status: 'disconnected', message: 'Desconectado do servidor central.' } });
        for (const c of observers.obs_ui_events) { c.send(msg); }
        setTimeout(connectToCentralServer, delay);
        reconnectionAttempt++;
    });

    centralSocket.on('error', (err) => {
        console.error('Erro no socket central:', err.message);
        const msg = JSON.stringify({ act: 'central_status', data: { status: 'error', message: `Erro de conexão: ${err.message}` } });
        for (const c of observers.obs_ui_events) { c.send(msg); }
    });

    // Limpa o socket em caso de erro para permitir nova tentativa
    centralSocket.on('error', () => centralSocket = null);
}

function loadGA(dbpath, metaheuristic = 'GA') {
    // let dbpath = "../exemplosGrafos/grafoK5.txt";
    // let dbpath = "../exemplosGrafos/homer.col.txt";
    // let dbpath = "../exemplosGrafos/queen5_5.col.txt";
    // let dbpath = "../exemplosGrafos/clique34.txt";
    // let dbpath = "../exemplosGrafos/clique62.txt";
    // let dbpath = "../exemplosGrafos/clique94.txt";


    let txt = fs.readFileSync(dbpath, { encoding: "utf-8" });

    let graph = new Graph();
    graph.importFromText(txt);
    graph.calcMatAdjs();

    if (metaheuristic === 'GRASP') {
        ga = new GRASP(CliqueMask.getConstructor(graph), graph.nodes.length);
    } else { // Default to GA
        ga = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);
    }

    ga.setObservers("running", (txt) => {
        for (const c of observers.obs_running) {
            c.send(JSON.stringify({ act: "running_data", data: txt }));
        }
    });
    ga.setObservers("new_best", (individual) => {
        // Durante a inicialização de um novo projeto, currentSave ainda não existe.
        // A primeira "melhor solução" será capturada quando o treeModel for criado.
        if (!currentSave) return;
        //Verifica o globalBest, se for melhor substitui.
        // Garante que estamos comparando com o melhor fitness global conhecido.
        if (individual.fitness > globalBest.bestFitness) {
            globalBest.bestFitness = individual.fitness;
            globalBest.individuals = [{
                metaheuristic: currentSave.metaheuristic,
                user: currentSave.userName,
                nodeMask: individual.nodeMask
            }];
            saveGlobalBest();
            reportBestToCentral(globalBest.individuals[0]); // Envia a nova melhor solução
        } else if (individual.fitness === globalBest.bestFitness) {
            // Verifica se já existe esse indivíduo no globalBest
            let isEqual = false;
            for (const ind of globalBest.individuals) {
                // ind.nodeMask já está descompactado em memória por initGlobalBest
                if (individual.isEqual({ nodeMask: ind.nodeMask })) {
                    isEqual = true;
                    break;
                }
            }

            if (!isEqual) {
                const newIndividual = {
                    metaheuristic: currentSave.metaheuristic,
                    user: currentSave.userName,
                    nodeMask: individual.nodeMask
                };
                globalBest.individuals.push(newIndividual);
                // Salva localmente e reporta, pois é uma nova solução com o mesmo score
                saveGlobalBest();
                reportBestToCentral(newIndividual); // Envia a nova solução com o mesmo score
            }
        }
        // Reavalia se o indicador de importação deve ser exibido ou ocultado
        checkAndNotifyForBetterSolution();

    });

    ga.init();
    lastCpuUsage = process.cpuUsage();
    lastHrTime = process.hrtime.bigint();

    if (currentSave) {
        treeModel = TreeSaveModel.fromRoot(currentSave.treeModel, ga);
    } else {
        treeModel = new TreeSaveModel(ga);
    }

}



server.on('connection', ws => {
    console.log("Client connected");

    clients.push(ws);
    ws.on('message', message => {

        // console.log(`Received: ${message}`);
        const obj = JSON.parse(message);
        switch (obj.act) {
            case "obs":
                obj.data.forEach(d => observers[`obs_${d}`] ? observers[`obs_${d}`].push(ws) : false);
                break;
            case "get_parameters":
                if (ga)
                    ws.send(JSON.stringify({ act: "data", data: ga.getParameters() }));
                break;
            case "get_parameters_options":
                if (ga)
                    ws.send(JSON.stringify({ act: "options", data: ga.getParametersOptions() }));
                break;
            case "set_parameters":
                logger.log("GA_setting", Object.keys(obj.data).join(","));
                ga.setParameters(obj.data);
                break;
            case "command":
                if (obj.data === "partialReset") {
                    if (logger) logger.log("GA_setting", "partialReset");
                    partialReset = true;
                    // Notify the main dashboard to reset charts
                    for (const c of observers.obs_ui_events) {
                        c.send(JSON.stringify({ act: "resetCharts" }));
                    }
                } else if (obj.data === "initial_individuals") {

                    ws.send(JSON.stringify({
                        act: "data", data: {
                            population: ga.initialPopulation.map(i => { return { nodeMask: i.nodeMask, fitness: i.fitness } }),
                            generation: 0
                        }
                    }));
                } else if (obj.data === "play") {
                    if (logger) logger.log("GA_running", "play");
                    isRunning = true;
                } else if (obj.data === "pause") {
                    if (logger) logger.log("GA_running", "pause");
                    isRunning = false;
                } else if (obj.data === "stop") {
                    if (logger) logger.log("GA_running", "stop");
                    isRunning = false;
                    // Opcionalmente reiniciar o algoritmo
                    if (treeModel) treeModel.load(treeModel.getActive());
                    ws.send(JSON.stringify({ act: "status", data: "stopped" }));
                }
                else if (obj.data === "next") {
                    if (logger) logger.log("GA_running", "next");
                    runSingleStep = true;
                }
                else if (obj.data === "setSpeed" && obj.speed !== undefined) {
                    if (logger) logger.log("GA_running", "setSpeed");
                    // Converter o valor do slider (0-100) para um intervalo adequado (por exemplo, 10-200ms)
                    executionSpeed = 210 - obj.speed * 2; // Inverte a lógica (100 = rápido, 0 = lento)
                    if (executionSpeed < 10) executionSpeed = 10; // Limite mínimo

                    // Reinicia o intervalo com a nova velocidade
                    clearInterval(mainInterval);
                    startMainLoop();
                    ws.send(JSON.stringify({ act: "status", data: `speed set to ${executionSpeed}ms` }));
                }
                break;
            case "new_project":
                const { datasetName, saveName, userName, metaheuristic } = obj.data;
                const dataset_url = datasets[datasetName].url;
                // if (saves[saveName]) break; //Verificar se o usuário já criou um arquivo com esse nome.
                isRunning = false;
                currentSave = undefined;
                logger = new Logger(`${saveName}[${userName}].log.tsv`);
                logger.log("projectCRUD", "new_project");
                initGlobalBest(datasetName);
                loadGA(dataset_url, metaheuristic);
                currentSave = {
                    name: saveName,
                    userName,
                    metaheuristic,
                    dataset_url,
                    datasetName,
                    treeModel: treeModel.root
                }
                if (!fs.existsSync('./saves')) {
                    fs.mkdirSync('./saves', { recursive: true });
                }
                fs.writeFile(`./saves/${saveName}.json`, JSON.stringify(currentSave), (err) => {
                    if (err) { console.log("Não salvou!!", err); return; }
                    console.log(`Arquivo salvo com sucesso em saves/${saveName}.json`);
                });
                ws.send(JSON.stringify({
                    act: "treeModel", data: {
                        tree: treeModel.getTreeModel(),
                        userName: currentSave.userName,
                        datasetName: currentSave.datasetName
                    }
                }));
                checkAndNotifyForBetterSolution();
                break;
            case "save_project":
                logger.log("projectCRUD", "save_project");
                if (!fs.existsSync('./saves')) {
                    fs.mkdirSync('./saves', { recursive: true });
                }
                fs.writeFile(`./saves/${currentSave.name}.json`, JSON.stringify(currentSave), (err) => {
                    if (err) { console.log("Não salvou!!", err); return; }
                    console.log(`Arquivo de save salvo com sucesso em saves/${currentSave.name}.json`);
                });
                break;
            case "load_project":
                isRunning = false;
                fs.readFile(`./saves/${obj.data.saveName}`, "utf8", (err, data) => {
                    if (err) { console.log("Não abriu!!", err); return; }
                    currentSave = JSON.parse(data);
                    const metaheuristicOnLoad = currentSave.metaheuristic; //#antigo que pega do projeto
                    logger = new Logger(`${currentSave.name}[${currentSave.userName}].log.tsv`);
                    logger.log("projectCRUD", "load_project");
                    initGlobalBest(currentSave.datasetName); // Initialize globalBest first
                    loadGA(currentSave.dataset_url, metaheuristicOnLoad);
                    treeModel.load(treeModel.getActive());

                    ws.send(JSON.stringify({
                        act: "treeModel", data: {
                            tree: treeModel.getTreeModel(),
                            userName: currentSave.userName,
                            datasetName: currentSave.datasetName
                        }
                    }));
                    checkAndNotifyForBetterSolution();
                    // reportBestToCentral();
                });
                break;
            case "save_state":
                if (treeModel) {
                    logger.log("GAStates", "save_state");
                    console.log("save_state")
                    treeModel.save();
                    ws.send(JSON.stringify({ act: "treeModelUpdate", data: treeModel.getTreeModel() }));
                }

                break;
            case "load_model":
                if (treeModel) {
                    logger.log("GAStates", "load_state");
                    treeModel.save();
                    treeModel.load(treeModel.selectByID(obj.data));
                    ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
                    for (const p of observers.obs_parameters) {
                        p.send(JSON.stringify({ act: "data", data: ga.getParameters() }));
                    }
                }
                break;
            case "get_tree_model":
                if (treeModel) {
                    if (logger) logger.log("GAStates", "get_tree_model");
                    ws.send(JSON.stringify({
                        act: "treeModel", data: {
                            tree: treeModel.getTreeModel(),
                            userName: currentSave ? currentSave.userName : 'N/A',
                            datasetName: currentSave ? currentSave.datasetName : 'N/A'
                        }
                    }));
                    // Envia o estado atual do indicador de nova solução ao carregar o modelo
                    ws.send(JSON.stringify({
                        act: 'new_solution_indicator',
                        data: { show: newSolutionAvailable }
                    }));
                }
                break;
            case "log":
                if (logger) logger.log(obj.data.type, obj.data.log);
                break;
            case "ls_dataset":
                ws.send(JSON.stringify({ act: "ls_dataset", data: datasets }));
                break;
            case "ls_saves":
                fs.readdir("./saves", (err, files) => {
                    if (err) { console.log("Não abriu!!", err); return; }
                    const fileData = files.map((file) => {
                        const filePath = path.join("./saves", file);
                        const fileContent = fs.readFileSync(filePath, "utf8");
                        const saveData = JSON.parse(fileContent);
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            modifiedAt: stats.mtime,
                            metaheuristic: saveData.metaheuristic,
                            userName: saveData.userName,
                        };
                    });

                    ws.send(JSON.stringify({ act: "ls_saves", data: fileData }));
                });
                break;
            case "set_central_server":
                if (obj.data && obj.data.ip) {
                    CENTRAL_SERVER_URL = `ws://${obj.data.ip}:${CENTRAL_SERVER_PORT}`;
                    console.log(`URL do servidor central definida para: ${CENTRAL_SERVER_URL}`);
                    if (centralSocket && (centralSocket.readyState === WebSocket.OPEN || centralSocket.readyState === WebSocket.CONNECTING)) {
                        console.log("Fechando conexão central existente antes de reconectar.");
                        centralSocket.close();
                    }
                    connectToCentralServer();
                }
                break;
            case "get_central_status":
                if (centralSocket && centralSocket.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ act: 'central_status', data: { status: 'connected', message: 'Conectado ao servidor central.' } }));
                } else if (centralSocket && centralSocket.readyState === WebSocket.CONNECTING) {
                    ws.send(JSON.stringify({ act: 'central_status', data: { status: 'connecting', message: 'Conectando ao servidor central...' } }));
                } else {
                    let message = 'Desconectado do servidor central.';
                    if (!CENTRAL_SERVER_URL) {
                        message = 'URL do servidor não definida.';
                    }
                    ws.send(JSON.stringify({ act: 'central_status', data: { status: 'disconnected', message: message } }));
                }
                break;
            case "reconnect_central_server": // Adicionado na interação anterior
                console.log("Recebido pedido para reconectar ao servidor central.");
                if (centralSocket && (centralSocket.readyState === WebSocket.OPEN || centralSocket.readyState === WebSocket.CONNECTING)) {
                    console.log("Já existe uma conexão ou tentativa de conexão em andamento. Nenhuma ação será tomada.");
                } else {
                    console.log("Nenhuma conexão ativa. Tentando conectar ao servidor central.");
                    connectToCentralServer();
                }
                break;
            case "import_global_best":
                if (currentSave) {
                    logger.log("projectCRUD", "import_global_best");
                    initGlobalBest(currentSave.datasetName); // Carrega o globalBest do arquivo

                    if (ga && globalBest && globalBest.individuals && globalBest.individuals.length > 0) {
                        console.log(`Importando ${globalBest.individuals.length} solução(ões) global(is) para a população.`);
                        globalBest.individuals.forEach(individual => {
                            // Adiciona cada indivíduo do recorde global na população atual do GA
                            ga.addIndividualToPopulation(individual.nodeMask);
                        });

                        console.log("globalBest.bestFitness", globalBest.bestFitness);
                        // Envia uma notificação de sucesso para o dashboard
                        ws.send(JSON.stringify({
                            act: "show_alert",
                            data: { message: `Solução da rede com fitness ${globalBest.bestFitness} importada com sucesso!`, color: "green" }
                        }));
                        newSolutionAvailable = false; // Define que a solução foi importada
                        // Envia notificação para esconder o indicador de nova solução
                        ws.send(JSON.stringify({
                            act: 'new_solution_indicator',
                            data: { show: false }
                        }));
                    }
                }
                break;


        }
    });

    ws.on('error', (err) => {
        console.log("ERROR:");
        console.log(err);
    });
    ws.on('close', () => {
        console.log("Client CLOSED");
    });


    ws.send(JSON.stringify({ act: "log", data: "Connected!" }));
});

let globalBest = {};
function initGlobalBest(datasetName) {
    if (!fs.existsSync('./bests')) {
        fs.mkdirSync('./bests', { recursive: true });
    }
    if (!fs.existsSync(`./bests/${datasetName}.json`)) {
        fs.writeFileSync(`./bests/${datasetName}.json`, JSON.stringify({
            bestFitness: 0,
            individuals: []
        }));
    }
    let str = fs.readFileSync(`./bests/${datasetName}.json`, "utf8");
    globalBest = JSON.parse(str);

    globalBest.individuals.forEach(individual => {
        // Descomprime o nodeMask
        const decompressed = zlib.gunzipSync(Buffer.from(individual.nodeMask, 'base64')).toString();
        individual.nodeMask = decompressed.split('').map(bit => parseInt(bit));
    });
    // fs.writeFile(`./saves/${saveName}.json`, JSON.stringify(currentSave), (err) => {
    //     if (err) { console.log("Não salvou!!", err); return; }
    //     console.log(`Arquivo salvo com sucesso em saves/${saveName}.json`);
    // });
}


function checkAndNotifyForBetterSolution() {
    // Compara o melhor fitness global com o melhor fitness local do projeto atual
    let shouldShow = false;
    if (ga && globalBest.bestFitness > ga.bestFitness) {
        shouldShow = true;
        console.log(`Nova solução da rede disponível! Global: ${globalBest.bestFitness}, Local: ${ga.bestFitness}`);
    }

    newSolutionAvailable = shouldShow;

    // Envia notificação para mostrar ou esconder o indicador
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                act: 'new_solution_indicator',
                data: { show: newSolutionAvailable }
            }));
        }
    });
}

function reportBestToCentral(individual) {
    if (centralSocket && centralSocket.readyState === WebSocket.OPEN && currentSave && individual) {
        // Cria uma cópia para não modificar o objeto original
        const individualToSend = JSON.parse(JSON.stringify(individual));

        // Comprime o nodeMask antes de enviar
        if (Array.isArray(individualToSend.nodeMask)) {
            individualToSend.nodeMask = zlib.gzipSync(individualToSend.nodeMask.join('')).toString('base64');
        }

        const fitness = individual.fitness || globalBest.bestFitness; // Pega o fitness do indivíduo ou do global
        console.log(`Reportando melhor resultado para o servidor central. Fitness: ${fitness}`);

        const payload = {
            type: 'report_best',
            payload: {
                datasetName: currentSave.datasetName,
                bestFitness: fitness,
                user: currentSave.userName,
                individual: individualToSend
            }
        };
        centralSocket.send(JSON.stringify(payload));
    }
}
function saveGlobalBest() {
    // currentSave
    // userName,
    // metaheuristic,
    // dataset_url,
    // datasetName,

    // Clona o objeto para não alterar o que está em memória
    const bestToSave = JSON.parse(JSON.stringify(globalBest));

    // Comprime o nodeMask de cada indivíduo antes de salvar
    bestToSave.individuals.forEach(individual => {
        individual.nodeMask = zlib.gzipSync(individual.nodeMask.join('')).toString('base64');
    });

    fs.writeFile(`./bests/${currentSave.datasetName}.json`, JSON.stringify(bestToSave), (err) => {
        if (err) { console.log("Não salvou!!", err); return; }
        console.log(`Arquivo globalBest salvo com sucesso em bests/${currentSave.datasetName}.json`);
    });
}

/**
 * Lê todos os arquivos da pasta /bests e os envia para o servidor central
 * para sincronização.
 */
function syncWithCentralServer() {
    if (!centralSocket || centralSocket.readyState !== WebSocket.OPEN) {
        console.log("Não é possível sincronizar: sem conexão com o servidor central.");
        return;
    }

    const bestsDir = './bests';
    if (!fs.existsSync(bestsDir)) {
        console.log("Pasta 'bests' não encontrada, nada para sincronizar.");
        return;
    }

    const syncPayload = [];
    const files = fs.readdirSync(bestsDir);

    files.forEach(file => {
        if (path.extname(file) === '.json') {
            const filePath = path.join(bestsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const bestData = JSON.parse(content);

            // Comprime os nodeMasks antes de enviar para sincronização
            bestData.individuals.forEach(individual => {
                if (Array.isArray(individual.nodeMask)) { // Comprime apenas se não estiver comprimido
                    individual.nodeMask = zlib.gzipSync(individual.nodeMask.join('')).toString('base64');
                }
            });

            const datasetName = path.basename(file, '.json');
            syncPayload.push({ datasetName, ...bestData });
        }
    });

    if (syncPayload.length > 0) {

        console.log(`Enviando ${syncPayload.length} registros de 'best' para sincronização.`);
        centralSocket.send(JSON.stringify({ type: 'sync_request', payload: syncPayload }));
    }
}

/**
 * Salva uma solução recebida da rede no arquivo de melhores correspondente.
 * Esta função é agnóstica ao projeto atual do cliente.
 * @param {string} datasetName - O nome do dataset da solução recebida.
 * @param {number} bestFitness - O fitness da solução.
 * @param {object} individual - O indivíduo/solução ({metaheuristic, user, nodeMask}).
 */
function saveNetworkBest(datasetName, bestFitness, individual) {
    let isNewRecord = false;
    const bestsDir = './bests';
    const filePath = `${bestsDir}/${datasetName}.json`;

    if (!fs.existsSync(bestsDir)) {
        fs.mkdirSync(bestsDir, { recursive: true });
    }

    let networkBest = { bestFitness: 0, individuals: [] };
    if (fs.existsSync(filePath)) {
        networkBest = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    if (bestFitness > networkBest.bestFitness) {
        networkBest.bestFitness = bestFitness;
        networkBest.individuals = [individual];
        isNewRecord = true;
    } else if (bestFitness === networkBest.bestFitness) {
        // Antes de comparar, precisamos garantir que ambos os masks estejam no mesmo formato (descomprimido).
        // No entanto, como o `saveNetworkBest` agora recebe o `individual` já comprimido do servidor central,
        // e os `existingInd` no arquivo local também estão comprimidos, a comparação direta de strings base64 funciona.
        const exists = networkBest.individuals.some(existingInd => existingInd.nodeMask === individual.nodeMask);

        if (!exists) networkBest.individuals.push(individual);
    }

    fs.writeFileSync(filePath, JSON.stringify(networkBest, null, 2));

    // Atualização automática em memória
    if (currentSave && currentSave.datasetName === datasetName && (isNewRecord || bestFitness === globalBest.bestFitness)) {
        console.log(`Atualizando globalBest em memória para o dataset ${datasetName}.`);
        // Clona o objeto para não modificar o que foi salvo em arquivo
        const updatedGlobalBest = JSON.parse(JSON.stringify(networkBest));

        // Descomprime os nodeMasks para o formato em memória
        updatedGlobalBest.individuals.forEach(ind => {
            const decompressed = zlib.gunzipSync(Buffer.from(ind.nodeMask, 'base64')).toString();
            ind.nodeMask = decompressed.split('').map(bit => parseInt(bit));
        });

        // Atualiza a variável globalBest em memória
        globalBest = updatedGlobalBest;
    }

    return isNewRecord;
}

let mainInterval;

function startMainLoop() {
    mainInterval = setInterval(() => {
        // Só executa se estiver rodando ou se for solicitado um único passo
        if (isRunning || runSingleStep) {
            for (const c of observers.obs_fitness) {
                let data = {
                    bestFitness: ga.population[0].fitness,
                    worstFitness: ga.population[ga.population.length - 1].fitness,
                    generation: ga.generation,
                    bestAge: ga.population[0].age,
                    bestCount: ga.bestIndividuals.length
                };
                if (ga.calcUpperBound) data.bestUpperBound = ga.bestUpperBound;
                c.send(JSON.stringify({ act: "data", type: "fitness", data }));
            }

            if (ga.generation % 1 === 0) {
                for (const c of observers.obs_individuals) {
                    c.send(JSON.stringify({
                        act: "data", type: "individuals", data: {
                            population: ga.population.map(i => { return { nodeMask: i.nodeMask, fitness: i.fitness } }),
                            generation: ga.generation,
                            bestFitness: ga.bestFitness
                        }
                    }));
                }
            }

            for (const c of observers.obs_best_individuals) {
                c.send(JSON.stringify({
                    act: "data", type: "best_individuals", data: {
                        bestIndividuals: ga.bestIndividuals.map(i => i.nodeMask),
                        bestFitness: ga.bestFitness
                    }
                }));
            }

            if (localBest < ga.population[0].fitness) {
                localBest = ga.population[0].fitness;
                console.log("Novo Best local!");
                logger.log("localBest", `${localBest}`);
            }


            console.log(`Best Fitness: ${ga.population[0].fitness}`);
            console.log(`Worst Fitness: ${ga.population[ga.population.length - 1].fitness}`);
            console.log(`Best age: ${ga.population[0].age}`);
            console.log(`Best Upper Bound: ${ga.bestUpperBound}`);
            console.log(`generation: ${ga.generation}`);
            console.log(`entropy: ${ga.entropy}`);

            // console.log('timings');
            // console.log(ga.timings);

            // Avança a geração
            ga.nextGeneration();

            // Métricas de Performance
            const now = process.hrtime.bigint();
            const elapsed = now - lastHrTime; // nanoseconds
            lastHrTime = now;

            const usage = process.cpuUsage();
            // elapsedUsage é em microsegundos
            const elapsedUsage = (usage.user - (lastCpuUsage.user || 0)) + (usage.system - (lastCpuUsage.system || 0));
            lastCpuUsage = usage;

            const cpuPercent = Math.min(100, elapsed > 0 ? (100 * elapsedUsage * 1000) / Number(elapsed) : 0); // Trava em 100%
            const memUsage = process.memoryUsage().heapUsed / 1024 / 1024; // em MB

            const metrics = {
                cpu: cpuPercent,
                memory: memUsage,
                loop: Object.values(ga.timings).reduce((a, b) => a + b, 0) / 1000, // em segundos
                // fitness: ga.timings.fitness / 1000 // em segundos
            };

            for (const c of observers.obs_timings) {
                c.send(JSON.stringify({ act: "timings", data: metrics }));
            }

            if (partialReset) {
                ga.partialReset();
                partialReset = false;
            }

            // Se executou um único passo, desativa o flag
            if (runSingleStep) {
                runSingleStep = false;

                // Notifica todos os clientes que um passo foi executado
                for (const client of clients) {
                    client.send(JSON.stringify({ act: "status", data: "step_executed" }));
                }
            }
        }
    }, executionSpeed);
}


// Inicia o loop principal
startMainLoop();
