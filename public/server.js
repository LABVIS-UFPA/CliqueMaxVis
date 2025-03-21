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
    obs_timings: []
};

const datasets = {
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
    }
}

let currentSave;


let partialReset = false;

let isRunning = false;
let runSingleStep = false;
let executionSpeed = 50;



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
const { GA } = require("./js-server/gen_alg.js");
let ga;
let treeModel;


function loadGA(dbpath) {
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

    ga = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);

    ga.setRunningObs((txt) => {
        for (const c of observers.obs_running) {
            c.send(JSON.stringify({ act: "running_data", data: txt }));
        }
    });

    ga.init();

    treeModel = new TreeSaveModel(ga);
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
                if(ga)
                    ws.send(JSON.stringify({ act: "data", data: ga.getParameters() }));
                break;
            case "set_parameters":
                logger.log("GA_setting", Object.keys(obj.data).join(","));
                ga.setParameters(obj.data);
                break;
            case "command":
                if (obj.data === "partialReset") {
                    logger.log("GA_setting","partialReset");
                    partialReset = true;
                } else if (obj.data === "initial_individuals") {
                    
                    ws.send(JSON.stringify({
                        act: "data", data: {
                            population: ga.initialPopulation.map(i => { return { nodeMask: i.nodeMask, fitness: i.fitness } }),
                            generation: 0
                        }
                    }));
                } else if (obj.data === "play") { 
                    logger.log("GA_running","play");
                    isRunning = true;
                } else if (obj.data === "pause"){
                    logger.log("GA_running","pause");
                    isRunning = false;
                } else if (obj.data === "stop") {
                    logger.log("GA_running","stop");
                    isRunning = false;
                    // Opcionalmente reiniciar o algoritmo
                    ga.init();
                    ga.generation = 0;
                    ws.send(JSON.stringify({ act: "status", data: "stopped" }));
                }
                else if (obj.data === "next") {
                    logger.log("GA_running","next");
                    runSingleStep = true;
                }
                else if (obj.data === "setSpeed" && obj.speed !== undefined) {
                    logger.log("GA_running","setSpeed");
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
                const { datasetName, saveName, userName } = obj.data;
                const dataset_url = datasets[datasetName].url;
                // if (saves[saveName]) break; //Verificar se o usuário já criou um arquivo com esse nome.
                isRunning = false;
                loadGA(dataset_url);
                logger = new Logger(`${saveName}[${userName}].log.tsv`);
                logger.log("projectCRUD","new_project");

                currentSave = {
                    name: saveName,
                    dataset_url,
                    datasetName,
                    treeModel: treeModel.root
                }
                fs.writeFile(`./saves/${saveName}.json`, JSON.stringify(currentSave), (err) => {
                    if(err) {console.log("Não salvou!!", err); return;}
                    console.log(`Arquivo salvo com sucesso em saves/${saveName}.json`);
                });
                ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
                break;
            case "save_project":
                logger.log("projectCRUD","save_project");
                fs.writeFile(`./saves/${currentSave.name}.json`, JSON.stringify(currentSave), (err) => {
                    if(err) {console.log("Não salvou!!", err); return;}
                    console.log(`Arquivo de save salvo com sucesso em saves/${currentSave.name}.json`);
                });
                break;
            case "load_project":
                // logger.log("projectCRUD","load_project");
                fs.readFile(`./saves/${obj.data.saveName}`, "utf8", (err, data) => {
                    if(err) {console.log("Não abriu!!", err); return;}
                    const objJSON = JSON.parse(data);
                    console.log(objJSON)
                });
                break;
            case "save_state":
                if(treeModel) {
                    logger.log("GAStates","save_state");
                    console.log("save_state")
                    treeModel.save();
                    ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
                }

                break;
            case "load_model":
                if(treeModel){
                    logger.log("GAStates","load_state");
                    treeModel.save();
                    treeModel.load(treeModel.selectByID(obj.data));
                    ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }))
                } 
                break;
            case "get_tree_model":
                if(treeModel){
                    logger.log("GAStates","get_tree_model");
                    ws.send(JSON.stringify({ act: "treeModel", data: treeModel.getTreeModel() }));
                } 
                break;
            case "log":
                if(logger) logger.log(obj.data.type,obj.data.log);
                break;
            case "ls_dataset":
                ws.send(JSON.stringify({ act: "ls_dataset", data: datasets }));
                break;
            case "ls_saves":
                fs.readdir("./saves", (err, files) => {
                    if(err) {console.log("Não abriu!!", err); return;}
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

    ws.on('error', (err)=>{
        console.log("ERROR:");
        console.log(err);
    });
    ws.on('close', ()=>{
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

            for (const c of observers.obs_timings) {
                c.send(JSON.stringify({ act: "timings", data: ga.timings }));
            }


            console.log(`Best Fitness: ${ga.population[0].fitness}`);
            console.log(`Worst Fitness: ${ga.population[ga.population.length - 1].fitness}`);
            console.log(`Best age: ${ga.population[0].age}`);
            console.log(`Best Upper Bound: ${ga.bestUpperBound}`);
            console.log(`generation: ${ga.generation}`);

            // console.log('timings');
            // console.log(ga.timings);

            // Avança a geração
            ga.nextGeneration();
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



