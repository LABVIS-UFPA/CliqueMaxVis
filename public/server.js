const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });
const { TreeSaveModel } = require("./js-server/TreeSaveModel.js");
const clients = [];
const Logger = require("./js-server/logger.js");
let logger;

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
    ga.setObservers("new_best", (bestFitness, allBest) => {
        //Verifica o globalBest, se for melhor substitui.
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
                loadGA(dataset_url, metaheuristic);
                logger = new Logger(`${saveName}[${userName}].log.tsv`);
                logger.log("projectCRUD", "new_project");

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
                ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
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
                    const metaheuristicOnLoad = currentSave.metaheuristic;
                    logger = new Logger(`${currentSave.name}[${currentSave.userName}].log.tsv`);
                    logger.log("projectCRUD", "load_project");
                    loadGA(currentSave.dataset_url, metaheuristicOnLoad);
                    treeModel.load(treeModel.getActive());
                    ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
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
                    logger.log("GAStates", "get_tree_model");
                    ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
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
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            modifiedAt: stats.mtime,
                        };
                    });

                    ws.send(JSON.stringify({ act: "ls_saves", data: fileData }));
                });
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
                            generation: ga.generation
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
