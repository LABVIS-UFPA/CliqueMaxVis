const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3214 });
const clients = [];

console.log("WebSocket server running on ws://localhost:3214");

server.on('connection', ws => {
    console.log("Client connected");
    
    clients.push(ws);
    ws.on('message', message => {
        console.log(`Received: ${message}`);
    });

    ws.send(JSON.stringify({act:"log", data:"Connected!"}));
});



const fs = require("fs");
const {Graph, CliqueBuilder, CliqueSolver, CliqueMask} = require("./graph.js");
const {GA} = require("./gen_alg.js");

// let dbpath = "../exemplosGrafos/grafoK5.txt";
// let dbpath = "../exemplosGrafos/homer.col.txt";
let dbpath = "../exemplosGrafos/queen5_5.col.txt";
// let dbpath = "../exemplosGrafos/clique34.txt";
// let dbpath = "../exemplosGrafos/clique34.txt";


let txt = fs.readFileSync(dbpath, {encoding:"utf-8"});

let graph = new Graph();
graph.importFromText(txt);
graph.calcMatAdjs();

let ga = new GA(CliqueMask.getConstructor(graph), graph.nodes.length);


ga.init();

setInterval(()=>{
    ga.nextGeneration();
    
    for (const c of clients) {
        c.send(JSON.stringify({act:"data", data:{
            bestFitness: ga.population[0].fitness, 
            generation: ga.generation
        }}));
    }

    
    console.log(`Best Fitness: ${ga.population[0].fitness}`);
    console.log(`Best age: ${ga.population[0].age}`);
    console.log(ga.population[0].nodeMask);
    console.log(`generation: ${ga.generation}`);
},900);




