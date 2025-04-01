
const { performance } = require('perf_hooks');



class GA {

    constructor(individualConstructor, numNodes) {
        this.newIndividual = individualConstructor
        this.timings = {};
        this.runningObs = ()=>{};

        this.generation = 0;
        this.numNodes = numNodes;
        this.bestIndividuals = [];
        this.bestFitness = 0;
        this.bestUpperBound = Number.MAX_SAFE_INTEGER;


        this.populationSize = 50;
        this.mutationRate = 0.2;
        this.mutationSelectionRate = 0.1;
        this.survivalRate = 0.25;
        this.nodeIncludeProb = 0.1
        this.maxAge = 30;
        this.isBestImmortal = true;
        this.hasMaxAge = true;
        this.hasExtractionImprovement = true;
        this.preventEqualIndividuals = false;
        this.calcUpperBound = false;

    }

    setRunningObs(func){
        if(func instanceof Function)
            this.runningObs = func;
    }

    init() {
        this.population = this.__generatePopulation();
        this.__fitness(this.population);
        this.__calculateEntropy();
        this.updateBest();
        this.generation = 1;
        this.population.sort((a, b) => b.fitness - a.fitness);
        this.initialPopulation = this.population;
    }

    nextGeneration() {
        let newPopulation = this.__crossover();
        this.__mutate(newPopulation);
        this.__fitness(newPopulation);
        this.__calculateEntropy();
        this.oldPopulation = this.population;
        this.population = this.__selection(newPopulation);
        this.updateBest();
        this.generation++;
    }

    updateBest() {
        if (this.bestFitness < this.population[0].fitness) {
            this.bestFitness = this.population[0].fitness;
            this.bestIndividuals = [];
        }
        for (const individual of this.population) {
            if (individual.fitness < this.bestFitness) break;
            let isEqual = false;
            for (const b of this.bestIndividuals) {
                if (b.isEqual(individual)) { isEqual = true; break; }
            }
            if (!isEqual) this.bestIndividuals.push(individual);
        }
    }

    getParameters() {
        const { 
            populationSize, mutationRate, mutationSelectionRate, survivalRate,
            maxAge, hasMaxAge, isBestImmortal, hasExtractionImprovement, preventEqualIndividuals,
            nodeIncludeProb,calcUpperBound
        } = this;
        return {
            populationSize, mutationRate, mutationSelectionRate, survivalRate,
            maxAge, hasMaxAge, isBestImmortal, hasExtractionImprovement, preventEqualIndividuals,
            nodeIncludeProb,calcUpperBound
        };
    }
    setParameters(params) {
        for (let attr in params) {
            this[attr] = params[attr];
        }
    }
    partialReset() {
        this.runningObs("Partial Reset");
        let midpoint = Math.floor(this.population.length * this.survivalRate);
        for (let i = midpoint; i < this.populationSize; i++) {
            this.population[i] = this.__generateIndividual();
        }
        this.population.sort((a, b) => b.fitness - a.fitness);
    }

    __fitness(population) {
        this.runningObs("Calculating Fitness");
        const t1 = performance.now();
        for (const individual of population) {
            individual.fitness = individual.verifyClique();
        }
        if(this.calcUpperBound){
            for (const individual of population) {
                individual.upperBound = individual.colorir().colorCount;
                if(individual.upperBound < this.bestUpperBound) 
                    this.bestUpperBound = individual.upperBound;
            }
        }
        this.timings.fitness = performance.now()-t1;
    }
    __crossover() {
        this.runningObs("Making Crossover");
        const t1 = performance.now();
        const population = this.population;
        const newIndividual = this.newIndividual;
        let newPopulation = [];
        while (newPopulation.length < this.populationSize) {
            let [p1, p2] = [population[Math.floor(Math.random() * population.length)],
            population[Math.floor(Math.random() * population.length)]];
            const midpoint = Math.floor(Math.random() * p1.nodeMask.length);
            let newMask = p1.nodeMask.slice(0, midpoint).concat(p2.nodeMask.slice(midpoint));

            let newI = newIndividual(newMask);
            if (this.hasExtractionImprovement) newI.extraction().improvement();
            newI.age=0;
            
            if (this.preventEqualIndividuals) {
                let isEqual = false;
                for (const i of newPopulation) {
                    if (newI.isEqual(i)) {
                        isEqual = true;
                        break;
                    }
                }
                if (isEqual) continue;
                for (const i of population) {
                    if (newI.isEqual(i)) {
                        isEqual = true;
                        break;
                    }
                }
                if (isEqual) continue;
            }

            newPopulation.push(newI);
        }
        this.timings.crossover = performance.now()-t1;
        return newPopulation;
    }

    __mutate(population) {
        this.runningObs("Mutating");
        const t1=performance.now();
        for (const individual of population) {
            if (Math.random() < this.mutationSelectionRate) {
                for (let i = 0; i < individual.nodeMask.length; i++) {
                    if (Math.random() < this.mutationRate)
                        individual.nodeMask[i] = 1 - individual.nodeMask[i];
                }
                if (this.hasExtractionImprovement) individual.extraction().improvement();
            }
        }
        this.timings.mutation = performance.now()-t1;
    }

    __selection(newPopulation) {
        this.runningObs("Selecting Next Population");
        const t1 = performance.now();
        const oldPopulation = this.population;
        let best;
        if(this.isBestImmortal) best = oldPopulation.splice(0,1)[0];
        if (this.hasMaxAge) {
            for (const i of oldPopulation) if (i.age > this.maxAge) i.fitness = 0;
            for (const i of newPopulation) if (i.age > this.maxAge) i.fitness = 0;
            
            oldPopulation.sort((a, b) => b.fitness - a.fitness);
            newPopulation.sort((a, b) => b.fitness - a.fitness);
        }
        if(this.isBestImmortal) oldPopulation.unshift(best);
        
        let midpoint = Math.floor(oldPopulation.length * this.survivalRate);
        let nextPopulation = oldPopulation.slice(0, midpoint).concat(newPopulation.slice(0, this.populationSize - midpoint));

        nextPopulation.sort((a, b) => b.fitness - a.fitness);

        for (const individual of nextPopulation) {
            individual.age++;
        }
        this.timings.selection = performance.now()-t1;
        return nextPopulation;
    }

    __generatePopulation() {
        this.runningObs("Generating Initial Population");
        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.__generateIndividual());
        }
        return population;
    }
    __generateIndividual() {
        const newIndividual = this.newIndividual, numNodes = this.numNodes;
        let individual = newIndividual(Array.from({ length: numNodes },
            () => Math.random() > this.nodeIncludeProb ? 0 : 1));

        if (this.hasExtractionImprovement) individual.extraction().improvement();
        individual.age=0;
        return individual;
    }

    __calculateEntropy() {
        const population = this.population;
        const geneCount = population[0].nodeMask.length; // Número de genes por indivíduo
        const populationSize = population.length;
    
        let totalEntropy = 0;
    
        for (let geneIndex = 0; geneIndex < geneCount; geneIndex++) {
            let frequency = { 0: 0, 1: 0 };
    
            // Conta a frequência dos valores genéticos (0 ou 1) no gene atual
            population.forEach(individual => {
                frequency[individual.nodeMask[geneIndex]]++;
            });
    
            // Calcula as probabilidades
            const p0 = frequency[0] / populationSize;
            const p1 = frequency[1] / populationSize;
    
            // Calcula a entropia para o gene atual
            let entropy = 0;
            if (p0 > 0) entropy -= p0 * Math.log2(p0);
            if (p1 > 0) entropy -= p1 * Math.log2(p1);
    
            totalEntropy += entropy;
        }
    
        this.entropy =  totalEntropy/populationSize;
    }
    

}



if (typeof module !== "undefined") module.exports = { GA };