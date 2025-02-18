const numNodes = 10;
const populationSize = 100;
const mutationRate = 0.05;
const generations = 1000;

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