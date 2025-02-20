
const populationSize = 100;
const mutationRate = 0.05;
const survivalRate = 0.5;



class GA{

    constructor(individualConstructor, numNodes){
        this.newIndividual = individualConstructor
        this.generatePopulation = GA.generatePopulation.simples;
        this.fitness = GA.fitness.std;
        this.crossover = GA.crossover.simples;
        this.mutate = GA.mutate.simples;
        this.selection = GA.selection.simples;
        this.generation = 0;
        this.numNodes = numNodes;
    }

    init(){
        this.population = this.generatePopulation(this.newIndividual, this.numNodes);
        this.fitness(this.population);
        this.generation = 1;
    }

    nextGeneration(){
        let newPopulation = this.crossover(this.population,this.newIndividual);
        this.mutate(newPopulation);
        this.fitness(newPopulation);
        this.oldPopulation = this.population;
        this.population = this.selection(this.population, newPopulation);
        this.generation++;
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
GA.generatePopulation.simples = (newIndividual, numNodes) => {
    let population = [];
    for (let i = 0; i < populationSize; i++) {
        let individual = newIndividual(Array.from({ length: numNodes }, 
            () => Math.random() > 0.5 ? 1 : 0));
        population.push(individual);
    }
    return population;
}







if(typeof module !== "undefined") module.exports = {GA};