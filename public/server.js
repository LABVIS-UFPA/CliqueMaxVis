const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });
const {TreeSaveModel} = require("./TreeSaveModel.js");
const clients = [];
const obs_fitness = [];
const obs_individuals = [];
const obs_best_individuals = [];


let partialReset = false;

let isRunning = false;  
let runSingleStep = false;  
let executionSpeed = 50; 



console.log("WebSocket server running on ws://localhost:3214");





const fs = require("fs");
const {Graph, CliqueBuilder, CliqueSolver, CliqueMask} = require("./graph.js");
const {GA} = require("./gen_alg.js");

// let dbpath = "../exemplosGrafos/grafoK5.txt";
// let dbpath = "../exemplosGrafos/homer.col.txt";
// let dbpath = "../exemplosGrafos/queen5_5.col.txt";
// let dbpath = "../exemplosGrafos/clique34.txt";
// let dbpath = "../exemplosGrafos/clique62.txt";
let dbpath = "../exemplosGrafos/clique94.txt";


let txt = fs.readFileSync(dbpath, {encoding:"utf-8"});

let graph = new Graph();
graph.importFromText(txt);
graph.calcMatAdjs();

let ga = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);

ga.setRunningObs((txt)=>{
    // for (const c of observers.obj_running) {
    //     c.send({act:"running_data", data:txt});
    // }
});

ga.init();

const treeModel = new TreeSaveModel(ga);






server.on('connection', ws => {
    console.log("Client connected");
    
    clients.push(ws);
    ws.on('message', message => {

        // console.log(`Received: ${message}`);
        const obj = JSON.parse(message);
        switch (obj.act){
            case "obs":
                //obj.data.forach(d=>objs[`obs_${d}`].push(ws));
                if(obj.data === "fitness"){
                    obs_fitness.push(ws);
                }else if(obj.data === "individuals"){
                    obs_individuals.push(ws);
                }else if(obj.data === "best_individuals"){
                    obs_best_individuals.push(ws);
                }
                break;
            case "get_parameters":
                ws.send(JSON.stringify({act:"data", data: ga.getParameters()}));
                break;
            case "set_parameters":
                ga.setParameters(obj.data);
                break;
                case "command":
                    if(obj.data === "partialReset") partialReset = true;
                    else if(obj.data === "initial_individuals") 
                        ws.send(JSON.stringify({act:"data", data: {
                            population: ga.initialPopulation.map(i=>{return {nodeMask:i.nodeMask, fitness: i.fitness}}),
                            generation: 0
                        }}));
                    else if(obj.data === "play") isRunning = true;
                    else if(obj.data === "pause") isRunning = false;
                    else if(obj.data === "stop") {
                        isRunning = false;
                        // Opcionalmente reiniciar o algoritmo
                        ga.init();
                        ga.generation = 0;
                        ws.send(JSON.stringify({act:"status", data:"stopped"}));
                    }
                    else if(obj.data === "next") {
                        runSingleStep = true;
                    }
                    else if(obj.data === "setSpeed" && obj.speed !== undefined) {
                        // Converter o valor do slider (0-100) para um intervalo adequado (por exemplo, 10-200ms)
                        executionSpeed = 210 - obj.speed * 2; // Inverte a lógica (100 = rápido, 0 = lento)
                        if (executionSpeed < 10) executionSpeed = 10; // Limite mínimo
                        
                        // Reinicia o intervalo com a nova velocidade
                        clearInterval(mainInterval);
                        startMainLoop();
                        ws.send(JSON.stringify({act:"status", data:`speed set to ${executionSpeed}ms`}));
                    }
                    break;

        }
    });

    ws.send(JSON.stringify({act:"log", data:"Connected!"}));
});



let mainInterval;

function startMainLoop() {
    mainInterval = setInterval(() => {
        // Só executa se estiver rodando ou se for solicitado um único passo
        if (isRunning || runSingleStep) {
            for (const c of obs_fitness) {
                let data = {
                    bestFitness: ga.population[0].fitness,
                    worstFitness: ga.population[ga.population.length-1].fitness,
                    generation: ga.generation,
                    bestAge: ga.population[0].age
                };
                if(ga.calcUpperBound) data.bestUpperBound = ga.bestUpperBound;
                c.send(JSON.stringify({act:"data", data}));
            }

            if(ga.generation % 1 === 0){
                for (const c of obs_individuals) {
                    c.send(JSON.stringify({act:"data", data:{
                        population: ga.population.map(i=>{return {nodeMask:i.nodeMask, fitness: i.fitness}}),
                        generation: ga.generation
                    }}));
                }
            }
        
            for (const c of obs_best_individuals) {
                c.send(JSON.stringify({act:"data", data:{
                    bestIndividuals: ga.bestIndividuals.map(i=>i.nodeMask),
                    bestFitness: ga.bestFitness
                }}));
            }
        
            
            console.log(`Best Fitness: ${ga.population[0].fitness}`);
            console.log(`Worst Fitness: ${ga.population[ga.population.length-1].fitness}`);
            console.log(`Best age: ${ga.population[0].age}`);
            console.log(`Best Upper Bound: ${ga.bestUpperBound}`);
            console.log(`generation: ${ga.generation}`);

            console.log('timings');
            console.log(ga.timings);
            
            // Avança a geração
            ga.nextGeneration();
            if(partialReset){
                ga.partialReset();
                partialReset = false;
            }
            
            // Se executou um único passo, desativa o flag
            if (runSingleStep) {
                runSingleStep = false;
                
                // Notifica todos os clientes que um passo foi executado
                for (const client of clients) {
                    client.send(JSON.stringify({act:"status", data:"step_executed"}));
                }
            }
        }
    }, executionSpeed);
}

// Inicia o loop principal
startMainLoop();

