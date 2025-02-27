const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });
const clients = [];
const obs_fitness = [];
const obs_individuals = [];

console.log("WebSocket server running on ws://localhost:3214");

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
                }
        }
    });

    ws.send(JSON.stringify({act:"log", data:"Connected!"}));
});



const fs = require("fs");
const {Graph, CliqueBuilder, CliqueSolver, CliqueMask} = require("./graph.js");
const {GA} = require("./gen_alg.js");

// let dbpath = "../exemplosGrafos/grafoK5.txt";
// let dbpath = "../exemplosGrafos/homer.col.txt";
// let dbpath = "../exemplosGrafos/queen5_5.col.txt";
// let dbpath = "../exemplosGrafos/clique34.txt";
let dbpath = "../exemplosGrafos/clique62.txt";


let txt = fs.readFileSync(dbpath, {encoding:"utf-8"});

let graph = new Graph();
graph.importFromText(txt);
graph.calcMatAdjs();

let ga = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);


ga.init();

setInterval(()=>{
    
    
    for (const c of obs_fitness) {
        c.send(JSON.stringify({act:"data", data:{
            bestFitness: ga.population[0].fitness,
            worstFitness: ga.population[ga.population.length-1].fitness,
            generation: ga.generation
        }}));
    }

    if(ga.generation % 1 === 0){
        for (const c of obs_individuals) {
            c.send(JSON.stringify({act:"data", data:{
                population: ga.population.map(i=>i.nodeMask),
                generation: ga.generation
            }}));
        }
    }
    
    console.log(`Best Fitness: ${ga.population[0].fitness}`);
    console.log(`Worst Fitness: ${ga.population[ga.population.length-1].fitness}`);
    console.log(`Best age: ${ga.population[0].age}`);
    // console.log(ga.population[0].nodeMask);
    console.log(`generation: ${ga.generation}`);
    
    ga.nextGeneration();
    // console.log(ga.population.map(i=>i.nodeMask));
},100);




