
const { performance } = require('perf_hooks');



class GA {

    constructor(individualConstructor, numNodes) {
        this.newIndividual = individualConstructor
        this.timings = {};
        this.runningObs = () => { };

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

        this.mutationType = "bitSwap"; //["bitSwap", "bitFlip"]

        // this.tabuTRIE = new TabuTRIE();

    }

    setRunningObs(func) {
        if (func instanceof Function)
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


        // for (const i of this.population) {
        //     if(!this.tabuTRIE.verify(i.nodeMask)){
        //         this.tabuTRIE.add(i.nodeMask);
        //     }else{
        //         console.log("VELHO!!!!!!!!!!!!!!");
        //     }

        // }

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
            nodeIncludeProb, calcUpperBound
        } = this;
        return {
            populationSize, mutationRate, mutationSelectionRate, survivalRate,
            maxAge, hasMaxAge, isBestImmortal, hasExtractionImprovement, preventEqualIndividuals,
            nodeIncludeProb, calcUpperBound
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
        if (this.calcUpperBound) {
            for (const individual of population) {
                individual.upperBound = individual.colorir().colorCount;
                if (individual.upperBound < this.bestUpperBound)
                    this.bestUpperBound = individual.upperBound;
            }
        }
        this.timings.fitness = performance.now() - t1;
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
            newI.age = 0;

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
        this.timings.crossover = performance.now() - t1;
        return newPopulation;
    }

    __mutate(population) {
        this.runningObs("Mutating");
        const t1 = performance.now();
        const len = population[0].nodeMask.length;
        const mutations = Math.floor(this.mutationRate * len);
        for (const individual of population) {
            if (Math.random() < this.mutationSelectionRate) {
                for (let i = 0; i < mutations; i++) {
                    GA.strategies.mutation[this.mutationType](individual);
                }
                if (this.hasExtractionImprovement) individual.extraction().improvement();
            }
        }
        this.timings.mutation = performance.now() - t1;
    }

    __selection(newPopulation) {
        this.runningObs("Selecting Next Population");
        const t1 = performance.now();
        const oldPopulation = this.population;
        let best;
        if (this.isBestImmortal) best = oldPopulation.splice(0, 1)[0];
        if (this.hasMaxAge) {
            for (const i of oldPopulation) if (i.age > this.maxAge) i.fitness = 0;
            for (const i of newPopulation) if (i.age > this.maxAge) i.fitness = 0;

            oldPopulation.sort((a, b) => b.fitness - a.fitness);
            newPopulation.sort((a, b) => b.fitness - a.fitness);
        }
        if (this.isBestImmortal) oldPopulation.unshift(best);

        let midpoint = Math.floor(oldPopulation.length * this.survivalRate);
        let nextPopulation = oldPopulation.slice(0, midpoint).concat(newPopulation.slice(0, this.populationSize - midpoint));

        nextPopulation.sort((a, b) => b.fitness - a.fitness);

        for (const individual of nextPopulation) {
            individual.age++;
        }
        this.timings.selection = performance.now() - t1;
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
        individual.age = 0;
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

        this.entropy = totalEntropy / populationSize;
    }


}

GA.strategies = {
    mutation: {
        bitFlip: (individual) => {
            const i = Math.floor(Math.random() * individual.nodeMask.length);
            individual.nodeMask[i] = 1 - individual.nodeMask[i];
        },
        bitSwap: (individual) => {
            const len = individual.nodeMask.length;
            const j = Math.floor(Math.random() * len);
            const k = Math.floor(Math.random() * len);
            const aux = individual.nodeMask[j];
            individual.nodeMask[j] = individual.nodeMask[k];
            individual.nodeMask[k] = aux;
        }
    }
}


class PermutGA {
    constructor(individualConstructor, numNodes) {
        this.newIndividual = individualConstructor
        this.maxCliqueSize = 1;
        this.numNodes = numNodes;
        this.bestIndividuals = [];
        this.epoch = 1;

        this.survivalRate = 0.25;
        this.populationSize = 500;
    }

    init() {
        this.population = this.__generatePopulation();
        this.__fitness(this.population);
        this.updateBest();
        this.generation = 1;
        this.population.sort((a, b) => b.fitness - a.fitness);
        this.initialPopulation = this.population;
    }
    nextGeneration() {
        let newPopulation = this.__crossover();
        this.__mutate(newPopulation);
        this.__fitness(newPopulation);
        // this.__calculateEntropy();
        this.oldPopulation = this.population;
        this.population = this.__selection(newPopulation);


        // for (const i of this.population) {
        //     if(!this.tabuTRIE.verify(i.nodeMask)){
        //         this.tabuTRIE.add(i.nodeMask);
        //     }else{
        //         console.log("VELHO!!!!!!!!!!!!!!");
        //     }

        // }

        this.updateBest();

        if (this.population[0].fitness >= 0) {
            this.maxCliqueSize++;
            this.epoch++;
            this.init();
        } else {
            this.generation++;
        }


    }

    __crossover() {
        return this.population.map(i => this.newIndividual(i.nodeMask));
    }
    __mutate(population) {
        for (let individual of population) {
            const mutated = individual.nodeMask;

            const selectedIndices = [];
            const unselectedIndices = [];

            // Separa os índices selecionados e não selecionados
            for (let i = 0; i < mutated.length; i++) {
                if (mutated[i] === 1) selectedIndices.push(i);
                else unselectedIndices.push(i);
            }

            // Só faz swap se tiver vértices selecionados e não selecionados
            if (selectedIndices.length > 0 && unselectedIndices.length > 0) {
                const randomSelected = selectedIndices[Math.floor(Math.random() * selectedIndices.length)];
                const randomUnselected = unselectedIndices[Math.floor(Math.random() * unselectedIndices.length)];

                // Faz o swap
                mutated[randomSelected] = 0;
                mutated[randomUnselected] = 1;
            }
        }
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

    __selection(newPopulation) {
        // this.runningObs("Selecting Next Population");
        // const t1 = performance.now();
        const oldPopulation = this.population;
        // let best;
        // if (this.isBestImmortal) best = oldPopulation.splice(0, 1)[0];
        // if (this.hasMaxAge) {
        //     for (const i of oldPopulation) if (i.age > this.maxAge) i.fitness = 0;
        //     for (const i of newPopulation) if (i.age > this.maxAge) i.fitness = 0;

        //     oldPopulation.sort((a, b) => b.fitness - a.fitness);
        //     newPopulation.sort((a, b) => b.fitness - a.fitness);
        // }
        // if (this.isBestImmortal) oldPopulation.unshift(best);

        let midpoint = Math.floor(oldPopulation.length * this.survivalRate);
        let nextPopulation = oldPopulation.slice(0, midpoint).concat(newPopulation.slice(0, this.populationSize - midpoint));

        nextPopulation.sort((a, b) => b.fitness - a.fitness);

        for (const individual of nextPopulation) {
            individual.age++;
        }
        // this.timings.selection = performance.now() - t1;
        return nextPopulation;
    }
    __generatePopulation() {
        // this.runningObs("Generating Initial Population");
        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.__generateIndividual());
        }
        return population;
    }

    __generateIndividual() {
        const newIndividual = this.newIndividual, numNodes = this.numNodes;
        let individual = newIndividual(Array(numNodes).fill(0));

        let count = 0;
        while (count < this.maxCliqueSize) {
            const randomPos = Math.floor(Math.random() * individual.nodeMask.length);
            if (individual.nodeMask[randomPos] === 0) {
                individual.nodeMask[randomPos] = 1;
                count++;
            }
        }
        individual.age = 0;
        return individual;
    }

    __fitness(population) {
        // this.runningObs("Calculating Fitness");
        // const t1 = performance.now();
        for (const individual of population) {
            individual.fitness = individual.verifyClique();
        }
        // if (this.calcUpperBound) {
        //     for (const individual of population) {
        //         individual.upperBound = individual.colorir().colorCount;
        //         if (individual.upperBound < this.bestUpperBound)
        //             this.bestUpperBound = individual.upperBound;
        //     }
        // }
        // this.timings.fitness = performance.now() - t1;
    }

}



class GRASP {
    constructor(individualConstructor, numNodes) {
        this.newIndividual = individualConstructor;
        this.numNodes = numNodes;
        this.runningObs = () => { };
        this.generation = 0;
        this.timings = {};
        
        this.populationSize = 20;
        this.alpha = 0.8; // parâmetro de aleatoriedade do GRASP
        this.beta = 0.5; // parâmetro de path relinking
        this.greedyInsert = true;//false;//true;
        
        this.population = [];
        this.bestIndividuals = [];
        this.bestFitness = 0;
        this.entropy = 0;
    }

    setRunningObs(func) {
        if (func instanceof Function)
            this.runningObs = func;
    }

    getParameters() {
        const { populationSize, alpha } = this;
        return { populationSize, alpha };
    }

    setParameters(params) {
        for (let attr in params) {
            this[attr] = params[attr];
        }
    }

    init() {
        this.population = [];
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push(this.__constructGreedyRandomized());
        }
        this.updateBest();
        this.generation = 1;
        this.population.sort((a, b) => b.fitness - a.fitness);
        this.initialPopulation = this.population;
    }

    nextGeneration() {
        // No GRASP clássico, cada iteração constrói uma nova solução e faz busca local
        this.runningObs("GRASP Iteration");
        
        const newPopulation = [];
        let individual = this.__constructGreedyRandomized();
        newPopulation.push(individual);
        while (newPopulation.length < this.populationSize) {
            //em this.beta% dos casos, faz path relinking com a última solução gerada
            // nos outros casos, gera uma nova solução via GRASP
            if (Math.random() < this.beta) {
                newPopulation.push(this.__pathRelinking(individual));
            }else{
                newPopulation.push(this.__constructGreedyRandomized());
            }
        }
        // }
        this.population = this.population.concat(newPopulation);
        this.population.sort((a, b) => b.fitness - a.fitness);
        this.population = this.population.slice(0, this.populationSize);
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

    partialReset() {
        this.runningObs("Partial Reset");
        this.init();
    }

    // --- Métodos internos do GRASP ---

    __constructGreedyRandomized() {
        const nodeMask = Array(this.numNodes).fill(0);
        let available = Array.from({ length: this.numNodes }, (_, i) => i);
        let connections = this.newIndividual.graph.getDegrees();

        //escolhe o primeiro vértice aleatoriamente.
        let chosen = Math.floor(Math.random() * available.length);
        nodeMask[chosen] = 1;

        available = this.__filterAvailable(available, connections, chosen);

        while (available.length > 0) {

            // available.sort(() => Math.random() - 0.5);
            
            const rclSize = Math.max(1, Math.floor(this.alpha * available.length));
            // const rcl = available.slice(0, rclSize);


            if (this.greedyInsert) {
                // Heurística gulosa: escolhe o vértice do RCL com mais conexões em available
                const indexAvailable = available.map((_, i) => i);
                GRASP.shuffleArray(indexAvailable);
                
                let best = available[indexAvailable[0]];
                for (let i = 1; i < rclSize; i++) {
                    if (connections[available[indexAvailable[i]]] > connections[best]) {
                        best = available[indexAvailable[i]];
                    }
                }
                chosen = best;
            } else {
                // Escolhe aleatoriamente do RCL
                chosen = available[Math.floor(Math.random() * rclSize)];
            }

            nodeMask[chosen] = 1;

            // Filtra available mantendo apenas vértices adjacentes ao novo escolhido
            available = this.__filterAvailable(available, connections, chosen);
        }

        const individual = this.newIndividual(nodeMask);
        individual.age = 0;
        individual.fitness = individual.verifyClique();
        return individual;
    }

    __filterAvailable(available, connections, chosen) {
        // Filtra available mantendo apenas vértices adjacentes ao novo escolhido
        const newAvailable = [];
        const removed = []
        for (let i = 0; i < available.length; i++) {
            if (available[i] === chosen) continue;
            if (this.newIndividual.graph.indexAdj[chosen][available[i]]) {
                newAvailable.push(available[i]);
            } else {
                removed.push(available[i])
            }
        }
        for (const r of removed) {
            const adjs = this.newIndividual.graph.indexAdj[r];
            for(let iadj = 0; iadj< adjs.length; iadj++){
                if(adjs[iadj])
                    connections[iadj]--;
            }
        }
        return newAvailable;
    }

    __pathRelinking(individual) {
        const rand = Math.floor(Math.random()*this.population.length);
        const other = this.population[rand];
        const newMask = individual.nodeMask.map((bit, idx) => bit & other.nodeMask[idx]);
        const newIndividual = this.newIndividual(newMask);
        newIndividual.age = individual.age;
        newIndividual.fitness = newIndividual.verifyClique();
        newIndividual.improvement();
        return newIndividual;
    }

    static shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}






class TabuTRIE {

    constructor() {
        this.root = new Array(2);
    }

    add(bitarray, i = 0, treeNode = this.root) {
        if (i < bitarray.length) {
            this.add(bitarray, i + 1, treeNode[bitarray[i]] = treeNode[bitarray[i]] || new Array(2));
        } else {
            treeNode.final = true;
        }
    }

    verify(bitarray, i = 0, treeNode = this.root) {
        if (i < bitarray.length) {
            return treeNode[bitarray[i]] ? this.verify(bitarray, i + 1, treeNode[bitarray[i]]) : false;
        }
        return treeNode.final || false;
    }

}



if (typeof module !== "undefined") module.exports = { GA, PermutGA, GRASP };