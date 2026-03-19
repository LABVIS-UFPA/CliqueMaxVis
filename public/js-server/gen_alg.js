
const { performance } = require('perf_hooks');

class MetaHeuristic {
    constructor(individualConstructor, numNodes) {
        this.newIndividual = individualConstructor;
        this.timings = {};
        this.observers = {
            "running": () => { },
            "new_best": () => { }
        };

        this.generation = 0;
        this.numNodes = numNodes;
        this.bestIndividuals = [];
        this.bestFitness = 0;
        this.bestUpperBound = Number.MAX_SAFE_INTEGER;

        
        this.population = [];
        this.initialPopulation = [];
        this.oldPopulation = [];
        this.populationSize = 50;
        this.entropy = 0;

        // selection / aging / duplicates / elitism defaults
        this.survivalRate = 0.25;
        this.maxAge = 30;
        this.hasMaxAge = true;
        this.isBestImmortal = true;
        this.preventEqualIndividuals = false;

        // optional flag used by subclasses/backend
        this.calcUpperBound = false;
    }

    // Observers
    setObservers(type, func) {
        if (func instanceof Function && this.observers[type]) this.observers[type] = func;
    }

    // Parameter plumbing (subclasses can extend getParametersOptions)
    getParameters() {
        const { populationSize, survivalRate, maxAge, hasMaxAge, isBestImmortal, preventEqualIndividuals, calcUpperBound } = this;
        return { populationSize, survivalRate, maxAge, hasMaxAge, isBestImmortal, preventEqualIndividuals, calcUpperBound };
    }
    setParameters(params) {
        for (let k in params) if (params.hasOwnProperty(k)) this[k] = params[k];
    }

    partialReset() {
        this.observers.running("Partial Reset");
        let midpoint = Math.floor(this.population.length * this.survivalRate);
        for (let i = midpoint; i < this.populationSize; i++) {
            this.population[i] = this.__generateIndividual();
        }
        this.population.sort((a, b) => b.fitness - a.fitness);
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
            if (!isEqual){
                this.bestIndividuals.push(individual);
                this.observers.new_best(individual)
            } 
        }
    }


    init() {
        this.observers.running("Generating Initial Population");
        this.population = this.__generatePopulation();
        this.updateBest();
        this.generation = 1;
        this.population.sort((a, b) => b.fitness - a.fitness);
        this.initialPopulation = this.population;
    }

    nextGeneration() {}

    __selection(newPopulation) {
        this.observers.running("Selecting Next Population");
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

    /**
     * Adiciona um novo indivíduo à população a partir de uma nodeMask.
     * O indivíduo é inserido na população, que é então reordenada.
     * @param {boolean[]} nodeMask A máscara de nós do indivíduo a ser adicionado.
     */
    addIndividualToPopulation(nodeMask) {
        if (!nodeMask || !this.population) {
            console.error("Tentativa de adicionar indivíduo com nodeMask nula ou população não inicializada.");
            return;
        }

        const newIndividual = this.newIndividual(nodeMask);
        newIndividual.fitness = newIndividual.verifyClique();
        newIndividual.age = 0; // Um indivíduo importado é "jovem"

        // Remove o pior indivíduo para dar espaço, se a população estiver cheia
        if (this.population.length >= this.populationSize) {
            this.population.pop();
        }

        this.population.push(newIndividual);
        this.population.sort((a, b) => b.fitness - a.fitness); // Mantém a população ordenada
    }
   
}

class GA extends MetaHeuristic {

    constructor(individualConstructor, numNodes) {
        super(individualConstructor, numNodes);

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

    nextGeneration() {
        let newPopulation = this.__crossover();
        this.__mutate(newPopulation);
        this.__fitness(newPopulation);
        // this.__calculateEntropy();
        this.oldPopulation = this.population;
        this.population = this.__selection(newPopulation);
        this.updateBest();
        this.generation++;
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
    getParametersOptions() {
        return [
            { displayName: "Population Size", variableName: "populationSize", type: "Int", min: 3, max: 250, step: 1 },
            { displayName: "Mutation Rate", variableName: "mutationRate", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Mutation Selection Rate", variableName: "mutationSelectionRate", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Mutation Type", variableName: "mutationType", type: "Options", options: ["bitFlip", "bitSwap"]  },
            { displayName: "Initial 1s Probability" ,variableName: "nodeIncludeProb", type: "Float", min: 0, max: 1, step: 0.05 }, 
            { displayName: "Improve Individuals", variableName: "hasExtractionImprovement", type: "Boolean" },
            { displayName: "Survival Rate", variableName: "survivalRate", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Max Age", variableName: "maxAge", type: "Int", min: 1, max: 100, step: 1 },
            { displayName: "Define Max Age", variableName: "hasMaxAge", type: "Boolean" },
            { displayName: "Immortal Best", variableName: "isBestImmortal", type: "Boolean" },
            { displayName: "Prevent Equal Individuals", variableName: "preventEqualIndividuals", type: "Boolean" }
        ];
    }

    __fitness(population) {
        this.observers.running("Calculating Fitness");
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
        this.observers.running("Making Crossover");
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
        this.observers.running("Mutating");
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

    __generatePopulation() {
        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.__generateIndividual());
        }
        this.__fitness(population);
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



class GRASP extends MetaHeuristic {
    constructor(individualConstructor, numNodes) {
        super(individualConstructor, numNodes);

        this.populationSize = 20;
        this.alpha = 0.8; // parâmetro de aleatoriedade do GRASP
        this.beta = 0.5; // parâmetro de path relinking
        this.elitismFactor = 0.1; // taxa de elitismo no path relinking. Quanto maior, mais elitista.
        this.greedyInsert = true;//false;//true; // se true, usa heurística gulosa para escolher vértices do RCL
        this.survivalRate = 0.25; // taxa de sobrevivência da população anterior
        this.maxAge = 30; // número máximo de iterações permitidas para uma mesma solução
        this.hasMaxAge = true; // habilita/desabilita maxAge
        this.isBestImmortal = true; // melhor solução é imortal
        this.preventEqualIndividuals = false; // previne duplicatas na população

    }

    getParameters() {
        const { populationSize, alpha, beta, elitismFactor, greedyInsert, survivalRate, maxAge, hasMaxAge, isBestImmortal, preventEqualIndividuals } = this;
        return { populationSize, alpha, beta, elitismFactor, greedyInsert, survivalRate, maxAge, hasMaxAge, isBestImmortal, preventEqualIndividuals };
    }

    getParametersOptions() {
        return [
            { displayName: "Population Size" ,variableName: "populationSize", type: "Int", min: 3, max: 250, step: 1 },
            { displayName: "RCL Rate (alpha)" ,variableName: "alpha", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Path Relinking Rate" ,variableName: "beta", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Elitism Rate" ,variableName: "elitismFactor", type: "Float", min: 0, max: 1, step: 0.05 }, 
            { displayName: "Greedy Algorithm" ,variableName: "greedyInsert", type: "Boolean" },
            { displayName: "Survival Rate" ,variableName: "survivalRate", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Max Age" ,variableName: "maxAge", type: "Int", min: 1, max: 100, step: 1 },
            { displayName: "Define Max Age" ,variableName: "hasMaxAge", type: "Boolean" },
            { displayName: "Immortal Best" ,variableName: "isBestImmortal", type: "Boolean" },
            { displayName: "Prevent Equal Individuals" ,variableName: "preventEqualIndividuals", type: "Boolean" }
        ];
    }

    nextGeneration() {
        // No GRASP clássico, cada iteração constrói uma nova solução e faz busca local
        this.observers.running("GRASP Iteration");
        const t1 = performance.now();

        const newPopulation = [];
        let individual = this.__constructGreedyRandomized();
        newPopulation.push(individual);
        while (newPopulation.length < this.populationSize) {
            //em this.beta% dos casos, faz path relinking com a última solução gerada
            // nos outros casos, gera uma nova solução via GRASP
            let newI;
            if (Math.random() < this.beta) {
                newI = this.__pathRelinking(individual);
            } else {
                newI = this.__constructGreedyRandomized();
            }
            // Caso haja prevenção de duplicatas, verifica se a nova solução já existe
            if(!this.preventEqualIndividuals || !this.__verifyEqual(newI, newPopulation))
                    newPopulation.push(newI);
        }
        // }
        // this.population = this.population.concat(newPopulation);
        // this.population.sort((a, b) => b.fitness - a.fitness);
        // this.population = this.population.slice(0, this.populationSize);

        this.population = this.__selection(newPopulation);
        this.updateBest();
        this.generation++;
        this.timings.iteration = performance.now() - t1;
    }

    __generatePopulation(){
        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.__constructGreedyRandomized());
        }
        return population;
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
            for (let iadj = 0; iadj < adjs.length; iadj++) {
                if (adjs[iadj])
                    connections[iadj]--;
            }
        }
        return newAvailable;
    }

    __pathRelinking(individual) {
        const rand = Math.floor(Math.random() * this.population.length * (1-this.elitismFactor));
        const other = this.population[rand];
        const newMask = individual.nodeMask.map((bit, idx) => bit & other.nodeMask[idx]);
        const newIndividual = this.newIndividual(newMask);
        newIndividual.improvement();
        newIndividual.age = individual.age;
        newIndividual.fitness = newIndividual.verifyClique();
        return newIndividual;
    }

    __verifyEqual(newI, newPopulation) {
            for (const i of newPopulation) {
                if (newI.isEqual(i))
                    return true;
            }
            for (const i of this.population) {
                if (newI.isEqual(i)) 
                    return true;
            }
            return false;
    }

    static shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}


class CRO extends MetaHeuristic {
    constructor(individualConstructor, numNodes) {
        super(individualConstructor, numNodes);

        // Valores defaults baseado nos artigos.
        this.populationSize = 10;
        this.KELossRate = 0.7;
        this.MoleColl = 0.3;
        this.buffer = 0;
        this.InitialKE = 500;
        this.alpha = 500;
        this.beta = 100;
        this.nodeIncludeProb = 0.5;

        // Keep project-level selection behavior configurable.
        this.maxAge = 500;
        this.hasMaxAge = false;
        this.isBestImmortal = false;
        this.preventEqualIndividuals = false;
    }

    getParameters() {
        const {
            populationSize, KELossRate, MoleColl, buffer, InitialKE,
            alpha, beta, nodeIncludeProb,
            maxAge, hasMaxAge, isBestImmortal, preventEqualIndividuals
        } = this;

        return {
            populationSize, KELossRate, MoleColl, buffer, InitialKE,
            alpha, beta, nodeIncludeProb,
            maxAge, hasMaxAge, isBestImmortal, preventEqualIndividuals
        };
    }

    getParametersOptions() {
        return [
            { displayName: "Population Size", variableName: "populationSize", type: "Int", min: 3, max: 250, step: 1 },
            { displayName: "Initial 1s Probability", variableName: "nodeIncludeProb", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Initial KE", variableName: "InitialKE", type: "Int", min: 0, max: 5000, step: 50 },
            { displayName: "KE Loss Rate", variableName: "KELossRate", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Molecule Collision", variableName: "MoleColl", type: "Float", min: 0, max: 1, step: 0.05 },
            { displayName: "Initial Buffer", variableName: "buffer", type: "Int", min: 0, max: 100000, step: 10 },
            { displayName: "Alpha", variableName: "alpha", type: "Int", min: 0, max: 5000, step: 10 },
            { displayName: "Beta", variableName: "beta", type: "Int", min: 0, max: 5000, step: 10 },
            { displayName: "Max Age", variableName: "maxAge", type: "Int", min: 1, max: 200, step: 1 },
            { displayName: "Define Max Age", variableName: "hasMaxAge", type: "Boolean" },
            { displayName: "Immortal Best", variableName: "isBestImmortal", type: "Boolean" },
            { displayName: "Prevent Equal Individuals", variableName: "preventEqualIndividuals", type: "Boolean" }
        ];
    }

    init() {
        if (!this.newIndividual?.graph?.matAjd) {
            this.newIndividual.graph.calcMatAdjs();
        }
        super.init();
    }

    nextGeneration() {
        this.observers.running("CRO Iteration");
        const t1 = performance.now();

        if (this.population.length === 0) {
            this.timings.iteration = performance.now() - t1;
            return;
        }

        let bestClone = null;
        if (this.isBestImmortal) {
            bestClone = this.__cloneIndividual(this.population[0]);
        }

        const b = Math.random();

        if (b > this.MoleColl || this.population.length === 1) {
            const idx = this.__randInt(0, this.population.length - 1);
            const mol = this.population[idx];

            if ((mol.NumHit - mol.MinHit) > this.alpha) {
                const produced = this.__decomposition(mol);
                if (produced.length === 2) {
                    this.__enlargeClique(produced[0]);
                    this.__enlargeClique(produced[1]);
                    this.population.splice(idx, 1, produced[0], produced[1]);
                }
            } else {
                this.__onWallIneffectiveCollision(mol);
                this.__enlargeClique(mol);
            }
        } else if (this.population.length >= 2) {
            let i = this.__randInt(0, this.population.length - 1);
            let j = this.__randInt(0, this.population.length - 1);
            while (j === i) j = this.__randInt(0, this.population.length - 1);

            const mol1 = this.population[i];
            const mol2 = this.population[j];

            // Trava de blowout. Só permite que a Síntese ocorra se a 
            // população atual for maior que a metade do PopSize inicial.
            // Isso força o algoritmo a usar a Colisão Ineficaz e dar tempo 
            // para a Decomposição agir e repovoar o ambiente.
            const canSynthesize = this.population.length > Math.floor(this.populationSize / 2);

            if (mol1.KE <= this.beta && mol2.KE <= this.beta && canSynthesize) {
                const merged = this.__synthesis(mol1, mol2);
                if (merged) {
                    this.__enlargeClique(merged);
                    const first = Math.max(i, j);
                    const second = Math.min(i, j);
                    this.population.splice(first, 1);
                    this.population.splice(second, 1);
                    this.population.push(merged);
                }
            } else {
                this.__interMolecularIneffectiveCollision(mol1, mol2);
                this.__enlargeClique(mol1);
                this.__enlargeClique(mol2);
            }
        }

        if (this.population.length > 0) {
            const q = this.population[this.__randInt(0, this.population.length - 1)];
            this.__repairOperator(q);
        }

        if (this.hasMaxAge) {
            for (const individual of this.population) {
                if (individual.age >= this.maxAge) {
                    individual.fitness = 0; 
                    individual.PE = 0;
                }
            }
        }

        for (const individual of this.population) {
            individual.age++;
            this.__refreshIndividual(individual);
        }

        this.population.sort((a, b) => b.fitness - a.fitness);

        if (this.isBestImmortal && bestClone) {
            if (this.population[0].fitness < bestClone.fitness) {
                this.population.unshift(bestClone);
            }
        }

        if (this.preventEqualIndividuals) {
            const uniquePop = [];
            const seen = new Set();
            for (const ind of this.population) {
                const hash = ind.nodeMask.join(""); 
                if (!seen.has(hash)) {
                    seen.add(hash);
                    uniquePop.push(ind);
                }
            }
            this.population = uniquePop;
        }

        if (this.population.length > this.populationSize * 5) {
            this.population.length = this.populationSize * 5; 
        }

        this.updateBest();
        this.generation++;
        this.timings.iteration = performance.now() - t1;
    }

    __generatePopulation() {
        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.__generateIndividual());
        }
        population.sort((a, b) => b.fitness - a.fitness);
        return population;
    }

    __generateIndividual() {
        const nodeMask = Array.from({ length: this.numNodes },
            () => Math.random() > this.nodeIncludeProb ? 0 : 1);
        const individual = this.newIndividual(nodeMask);
        individual.age = 0;
        this.__initMoleculeState(individual);
        this.__cliqueRepair(individual.nodeMask);
        this.__refreshIndividual(individual);
        return individual;
    }

    __initMoleculeState(individual) {
        individual.KE = this.InitialKE;
        individual.NumHit = 0;
        individual.MinStruct = individual.nodeMask.slice();
        // Como agora buscamos maximizar, o valor inicial base
        // para comparação do histórico deve ser 0 (pior clique possível).
        individual.MinPE = 0;
        individual.MinHit = 0;
        individual.PE = individual.fitness;
    }

    __cloneIndividual(individual) {
        const clone = this.newIndividual(individual.nodeMask.slice());
        clone.age = individual.age;
        clone.fitness = individual.fitness;
        clone.PE = individual.PE;
        clone.KE = individual.KE;
        clone.NumHit = individual.NumHit;
        clone.MinStruct = individual.MinStruct ? individual.MinStruct.slice() : individual.nodeMask.slice();
        clone.MinPE = Number.isFinite(individual.MinPE) ? individual.MinPE : individual.PE;
        clone.MinHit = individual.MinHit || 0;
        return clone;
    }

    __refreshIndividual(individual) {
        individual.fitness = individual.verifyClique();
        // A Energia Potencial reflete diretamente a maximização.
        individual.PE = individual.fitness; 
        this.__updateBestMoleculeState(individual);
    }

    __updateBestMoleculeState(individual) {
        // O algoritmo agora atualiza o histórico apenas se a nova PE for MAIOR.
        if (individual.PE > individual.MinPE) {
            individual.MinPE = individual.PE;
            individual.MinStruct = individual.nodeMask.slice();
            individual.MinHit = individual.NumHit;
        }
    }

    __randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    __randChoice(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    __getCliqueNodes(individual) {
        const nodes = [];
        for (let i = 0; i < individual.nodeMask.length; i++) {
            if (individual.nodeMask[i]) nodes.push(i);
        }
        return nodes;
    }

    __cliqueRepair(nodeMask) {
        const n = nodeMask.length;
        if (!n) return nodeMask;

        const r = this.__randInt(0, n - 1);

        for (let i = r; i < n; i++) {
            if (nodeMask[i] === 1) {
                for (let j = i + 1; j < n; j++) {
                    if (nodeMask[j] === 1 && !this.newIndividual.graph.matAjd[i][j]) {
                        nodeMask[j] = 0;
                    }
                }
                for (let j = 0; j < i; j++) {
                    if (nodeMask[j] === 1 && !this.newIndividual.graph.matAjd[i][j]) {
                        nodeMask[j] = 0;
                    }
                }
            }
        }

        for (let i = r - 1; i >= 0; i--) {
            if (nodeMask[i] === 1) {
                for (let j = i - 1; j >= 0; j--) {
                    if (nodeMask[j] === 1 && !this.newIndividual.graph.matAjd[i][j]) {
                        nodeMask[j] = 0;
                    }
                }
                for (let j = n - 1; j > i; j--) {
                    if (nodeMask[j] === 1 && !this.newIndividual.graph.matAjd[i][j]) {
                        nodeMask[j] = 0;
                    }
                }
            }
        }

        return nodeMask;
    }

    __enlargeClique(individual) {
        const nodeMask = individual.nodeMask;
        const n = nodeMask.length;
        const k = this.__randInt(0, n - 1);

        const cliqueNodes = [];
        for (let i = 0; i < n; i++) {
            if (nodeMask[i] === 1) cliqueNodes.push(i);
        }

        for (let node = k; node < n; node++) {
            if (nodeMask[node] === 1) continue;

            let connectedToAll = true;
            for (let i = 0; i < cliqueNodes.length; i++) {
                if (!this.newIndividual.graph.matAjd[node][cliqueNodes[i]]) {
                    connectedToAll = false;
                    break;
                }
            }

            if (connectedToAll) {
                nodeMask[node] = 1;
                cliqueNodes.push(node);
            }
        }

        this.__refreshIndividual(individual);
    }

    __onWallIneffectiveCollision(mol) {
        mol.NumHit++;

        const oldMask = mol.nodeMask.slice();
        const oldPE = mol.PE;
        const oldKE = mol.KE;

        const cliqueNodes = this.__getCliqueNodes(mol);
        if (cliqueNodes.length === 0) return;

        const selectedNode = this.__randChoice(cliqueNodes);
        const neighbors = this.newIndividual.graph.indexAdj[selectedNode];
        const candidates = [];

        for (let v = 0; v < this.numNodes; v++) {
            if (neighbors[v] && mol.nodeMask[v] === 0) {
                candidates.push(v);
            }
        }

        if (candidates.length > 0) {
            const newNode = this.__randChoice(candidates);
            mol.nodeMask[newNode] = 1;
        }

        this.__cliqueRepair(mol.nodeMask);
        this.__refreshIndividual(mol);

        const availableEnergy = oldPE + oldKE;
        if (mol.PE <= availableEnergy) {
            const energyDiff = availableEnergy - mol.PE;
            const rnd = Math.random();
            mol.KE = energyDiff * rnd * this.KELossRate;
            this.buffer += (energyDiff - mol.KE);
        } else {
            mol.nodeMask = oldMask;
            mol.PE = oldPE;
            mol.fitness = this.numNodes - oldPE; 
            mol.KE = oldKE;
        }

        this.__updateBestMoleculeState(mol);
    }

    __decomposition(mol) {
        mol.NumHit++;

        const cliqueNodes = this.__getCliqueNodes(mol);
        const midpoint = Math.floor(cliqueNodes.length / 2);
        const firstHalf = cliqueNodes.slice(0, midpoint);
        const secondHalf = cliqueNodes.slice(midpoint);

        const q1 = this.newIndividual(Array(this.numNodes).fill(0));
        const q2 = this.newIndividual(Array(this.numNodes).fill(0));
        q1.age = 0;
        q2.age = 0;
        this.__initMoleculeState(q1);
        this.__initMoleculeState(q2);

        for (const node of firstHalf) q1.nodeMask[node] = 1;
        for (let i = 0; i < this.numNodes; i++) {
            if (q1.nodeMask[i] === 0 && Math.random() < 0.5) q1.nodeMask[i] = 1;
        }
        this.__cliqueRepair(q1.nodeMask);
        this.__refreshIndividual(q1);

        for (const node of secondHalf) q2.nodeMask[node] = 1;
        for (let i = 0; i < this.numNodes; i++) {
            if (q2.nodeMask[i] === 0 && Math.random() < 0.5) q2.nodeMask[i] = 1;
        }
        this.__cliqueRepair(q2.nodeMask);
        this.__refreshIndividual(q2);

        const delta1 = Math.random();
        const delta2 = Math.random();
        const bufferContribution = delta1 * delta2 * this.buffer;
        const totalEnergy = mol.PE + mol.KE + bufferContribution;
        const requiredPE = q1.PE + q2.PE;

        if (totalEnergy >= requiredPE) {
            const surplus = totalEnergy - requiredPE;
            const rnd = Math.random();
            q1.KE = surplus * rnd;
            q2.KE = surplus * (1 - rnd);
            this.buffer = Math.max(0, this.buffer - bufferContribution);
            q1.NumHit = mol.NumHit;
            q2.NumHit = mol.NumHit;
            q1.MinHit = mol.MinHit;
            q2.MinHit = mol.MinHit;
            return [q1, q2];
        }

        this.__refreshIndividual(mol);
        return [mol];
    }

    __interMolecularIneffectiveCollision(mol1, mol2) {
        mol1.NumHit++;
        mol2.NumHit++;

        const oldMask1 = mol1.nodeMask.slice();
        const oldMask2 = mol2.nodeMask.slice();
        const oldPE1 = mol1.PE;
        const oldPE2 = mol2.PE;
        const oldKE1 = mol1.KE;
        const oldKE2 = mol2.KE;

        this.__applySingleNeighborAppend(mol1);
        this.__applySingleNeighborAppend(mol2);

        const totalEnergy = oldPE1 + oldPE2 + oldKE1 + oldKE2;
        const newTotalPE = mol1.PE + mol2.PE;

        if (totalEnergy >= newTotalPE) {
            const residual = totalEnergy - newTotalPE;
            const rnd = Math.random() * this.KELossRate;
            mol1.KE = residual * rnd;
            mol2.KE = residual - mol1.KE;
        } else {
            mol1.nodeMask = oldMask1;
            mol2.nodeMask = oldMask2;
            mol1.PE = oldPE1;
            mol2.PE = oldPE2;
            mol1.fitness = this.numNodes - oldPE1; 
            mol2.fitness = this.numNodes - oldPE2; 
            mol1.KE = oldKE1;
            mol2.KE = oldKE2;
        }

        this.__updateBestMoleculeState(mol1);
        this.__updateBestMoleculeState(mol2);
    }

    __applySingleNeighborAppend(mol) {
        const cliqueNodes = this.__getCliqueNodes(mol);
        if (!cliqueNodes.length) return;

        const selected = this.__randChoice(cliqueNodes);
        const neighbors = this.newIndividual.graph.indexAdj[selected];
        const candidates = [];

        for (let v = 0; v < neighbors.length; v++) {
            if (neighbors[v] && mol.nodeMask[v] === 0) {
                candidates.push(v);
            }
        }

        if (candidates.length > 0) {
            const node = this.__randChoice(candidates);
            mol.nodeMask[node] = 1;
        }

        this.__cliqueRepair(mol.nodeMask);
        this.__refreshIndividual(mol);
    }

    __synthesis(mol1, mol2) {
        mol1.NumHit++;
        mol2.NumHit++;

        const q = this.newIndividual(Array(this.numNodes).fill(0));
        q.age = 0;
        this.__initMoleculeState(q);

        for (let i = 0; i < this.numNodes; i++) {
            if (mol1.nodeMask[i] && mol2.nodeMask[i]) q.nodeMask[i] = 1;
        }

        this.__cliqueRepair(q.nodeMask);
        this.__refreshIndividual(q);

        const totalEnergy = mol1.PE + mol2.PE + mol1.KE + mol2.KE;
        const newKE = totalEnergy - q.PE;

        if (newKE >= 0) {
            q.KE = newKE;
            q.NumHit = Math.max(mol1.NumHit, mol2.NumHit);
            q.MinHit = Math.max(mol1.MinHit, mol2.MinHit);
            this.__updateBestMoleculeState(q);
            return q;
        }

        return null;
    }

    __repairOperator(mol) {
        let improved = true;

        while (improved) {
            improved = false;
            const cliqueNodes = this.__getCliqueNodes(mol);
            const adjoinable = [];

            for (let v = 0; v < this.numNodes; v++) {
                if (mol.nodeMask[v] === 1) continue;
                let ok = true;
                for (let i = 0; i < cliqueNodes.length; i++) {
                    if (!this.newIndividual.graph.matAjd[v][cliqueNodes[i]]) {
                        ok = false;
                        break;
                    }
                }
                if (ok) adjoinable.push(v);
            }

            if (!adjoinable.length) break;

            let bestVertex = -1;
            let bestRho = -1;

            for (const v of adjoinable) {
                let rho = 0;
                for (const u of adjoinable) {
                    if (u !== v && this.newIndividual.graph.matAjd[v][u]) rho++;
                }

                if (rho > bestRho) {
                    bestRho = rho;
                    bestVertex = v;
                }
            }

            if (bestVertex !== -1) {
                mol.nodeMask[bestVertex] = 1;
                improved = true;
            }
        }

        this.__refreshIndividual(mol);
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



if (typeof module !== "undefined") module.exports = { GA, PermutGA, GRASP, CRO };