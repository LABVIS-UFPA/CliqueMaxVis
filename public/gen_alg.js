//Código para enviar dados via WebSocket
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log("Connected to WebSocket server");
});

const numNodes = 10;
const populationSize = 100;
const mutationRate = 0.05;
const survivalRate = 0.5;
const newIndividual = 100;
const generations = 1000;


class GA{

    constructor(individualConstructor){
        this.newIndividual = individualConstructor
        this.generatePopulation = GA.generatePopulation.simples;
        this.fitness = GA.fitness.std;
        this.crossover = GA.crossover.simples;
        this.mutate = GA.mutate.simples;
        this.selection = GA.selection.simples;

    }

    init(){
        this.population = this.generatePopulation(this.newIndividual);
        this.fitness(this.population);
    }

    nextGeneration(){
        let newPopulation = this.crossover(this.population,this.newIndividual);
        this.mutate(newPopulation);
        this.fitness(newPopulation);
        this.oldPopulation = this.population;
        this.population = this.selection(this.population, newPopulation);
    }
}
GA.fitness={};
GA.fitness.std = (population)=>{
    for (const individual of population) {
        individual.fitness = individual.verifyClique();
    }
}

GA.crossover = {};
GA.crossover.simples = (population, newIndividual)=>{
    let newPopulation = [];
    while(newPopulation.length < newIndividual){
        let [p1, p2] = [population[Math.floor(Math.random() * population.length)],
        population[Math.floor(Math.random() * population.length)]];
        const midpoint = Math.floor(Math.random() * p1.nodeMask.length);
        let newMask = p1.nodeMask.slice(0, midpoint).concat(p2.nodeMask.slice(midpoint));
        newPopulation.push(newIndividual(newMask));
    }
    return newPopulation;
}

GA.mutate ={};
GA.mutate.simples = (population) => {
    for (const individual of population) {
        individual.nodeMask.map(bit => Math.random() < mutationRate ? 1 - bit : bit);
    }   
}

GA.selection = {};
GA.selection.simples = (oldPopulation, newPopulation) => {
    oldPopulation.sort((a, b) => b.fitness - a.fitness);
    newPopulation.sort((a, b) => b.fitness - a.fitness);
    let midpoint = Math.floor(populationSize * survivalRate);
    let nextPopulation = oldPopulation.slice(0, midpoint).concat(newPopulation.slice(0,oldPopulation.length - midpoint));

    for (const individual of nextPopulation) {
        if(individual.age) individual.age++;
        else individual.age = 1;
    }
    return nextPopulation;
}

GA.generatePopulation ={};
GA.generatePopulation.simples = (newIndividual) => {
    let population = [];
    for (let i = 0; i < populationSize; i++) {
        let individual = newIndividual(Array.from({ length: numNodes }, 
            () => Math.random() > 0.5 ? 1 : 0));
        population.push(individual);
    }
    return population;
}





function generateGraph(numNodes) {
    let graph = Array.from({ length: numNodes }, () => Array(numNodes).fill(0));
    for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
            graph[i][j] = graph[j][i] = Math.random() > 0.5 ? 1 : 0;
        }
    }
    return graph;
}

const graph = generateGraph(numNodes);

function randomIndividual() {
    return Array.from({ length: numNodes }, () => Math.random() > 0.5 ? 1 : 0);
}

function fitness(individual) {
    let count = individual.reduce((sum, bit) => sum + bit, 0);
    for (let i = 0; i < numNodes; i++) {
        for (let j = i + 1; j < numNodes; j++) {
            if (individual[i] && individual[j] && !graph[i][j]) {
                return 0;
            }
        }
    }
    return count;
}

function mutate(individual) {
    return individual.map(bit => Math.random() < mutationRate ? 1 - bit : bit);
}

function crossover(parent1, parent2) {
    const midpoint = Math.floor(Math.random() * parent1.length);
    return parent1.slice(0, midpoint).concat(parent2.slice(midpoint));
}

function evolve() {
    let population = Array.from({ length: populationSize }, randomIndividual);
    for (let gen = 0; gen < generations; gen++) {
        population.sort((a, b) => fitness(b) - fitness(a));
        console.log(`Generation ${gen}: Best fitness = ${fitness(population[0])}`);

        // Envia o melhor indivíduo para o WebSocket
        ws.send(JSON.stringify({
            generation: gen,
            fitness: fitness(population[0]),
            genes: population[0].genes
        }));

        if (fitness(population[0]) === numNodes) {
            console.log(`Maximum clique found in generation ${gen}:, population[0]`);
            return;
        }
        let newPopulation = population.slice(0, populationSize / 2);
        while (newPopulation.length < populationSize) {
            let [p1, p2] = [newPopulation[Math.floor(Math.random() * newPopulation.length)],
                            newPopulation[Math.floor(Math.random() * newPopulation.length)]];
            let child = mutate(crossover(p1, p2));
            newPopulation.push(child);
        }
        population = newPopulation;
    }
}

evolve();

if(typeof module !== "undefined") module.exports = {GA};