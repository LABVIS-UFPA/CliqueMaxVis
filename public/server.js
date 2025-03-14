const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });
const clients = [];
const obs_fitness = [];
const obs_individuals = [];
const obs_best_individuals = [];
const { performance } = require('perf_hooks');

let partialReset = false;


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






server.on('connection', ws => {
    console.log("Client connected");
    
    clients.push(ws);
    ws.on('message', message => {

        // console.log(`Received: ${message}`);
        const obj = JSON.parse(message);
        switch (obj.act){
            case "obs":
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
                break;

        }
    });

    ws.send(JSON.stringify({act:"log", data:"Connected!"}));
});







ga.init();


setInterval(()=>{
    
    
    for (const c of obs_fitness) {
        let data = {
            bestFitness: ga.population[0].fitness,
            worstFitness: ga.population[ga.population.length-1].fitness,
            generation: ga.generation
        };
        if(ga.calcUpperBound) data.bestUpperBound = ga.bestUpperBound;
        c.send(JSON.stringify({act:"data", data}));
    }

    if(ga.generation % 2 === 0){
        for (const c of obs_individuals) {
            c.send(JSON.stringify({act:"data", data:{
                population: ga.population.map(i=>i.nodeMask),
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

    // console.log(ga.population[0].nodeMask);
    console.log(`generation: ${ga.generation}`);
    
    
    ga.nextGeneration();
    if(partialReset){
        ga.partialReset();
        partialReset = false;
    }
    // console.log(ga.population.map(i=>i.nodeMask));
},50);




