
const zlib = require('zlib');
class TreeSaveModel{

    constructor(ga){
        this.ga = ga;
        this.selected = this.root = this.__getModel();
    }

    save(){
        const child = this.__getModel();
        this.selected.children.push(child);
        this.selected = child;
    }

    load(selected){
        this.selected = selected;
        this.__setModel(selected);
    }

    getTreeModel(node=this.root){
        const clonedNode = {};
        clonedNode.generation = node.generation;
        clonedNode.bestFitness = node.bestFitness;
        clonedNode.worstFitness = node.worstFitness;
        clonedNode.bestFitness = node.bestFitness;
        clonedNode.bestAge = node.bestAge;
        clonedNode.bestCount = node.bestCount;
        clonedNode.id = node.id;

        // Clona os filhos recursivamente, se existirem
        if (node.children) {
            clonedNode.children = node.children.map(child => this.getTreeModel(child));
        }
        
        return clonedNode;
    }
    selectByID(id, node=this.root){
        if(node.id===id) return node;
        for (const c of node.children) {
            const found = this.selectByID(id, c);
            if(found) return found;
        }
    }


    __setModel(selected){
        const popSize = selected.parameters.populationSize;
        const numNodes = this.ga.numNodes;
        const bestCount = selected.bestCount;

        this.ga.setParameters(selected.parameters);
        // this.ga.population = indicesToBinaryMatrix(selected.population).map(i=>this.ga.newIndividual(i));
        this.ga.population = decompress(selected.population,popSize, numNodes).map(i=>this.ga.newIndividual(i));
        this.ga.bestFitness = selected.bestFitness;
        this.ga.bestUpperBound = selected.bestUpperBound;
        this.ga.generation = selected.generation;
        this.ga.bestIndividuals = decompress(selected.bestIndividuals, bestCount,numNodes).map(i=>this.ga.newIndividual(i));

        for (let i = 0; i < this.ga.population.length; i++) {
            this.ga.population[i].fitness = selected.__fitnesses[i];
            this.ga.population[i].age = selected.__ages[i];
        }
    }
    __getModel(){
        return {
            id: this.__guidGenerator(),
            // population: binaryMatrixToIndices(this.ga.population.map(i=>i.nodeMask)),
            population: compress(this.ga.population.map(i=>i.nodeMask)),
            bestFitness: this.ga.bestFitness,
            worstFitness: this.ga.population[this.ga.population.length-1].fitness,
            bestAge: this.ga.population[0].age,
            bestUpperBound: this.ga.bestUpperBound,
            generation: this.ga.generation,
            // bestIndividuals: binaryMatrixToIndices(this.ga.bestIndividuals.map(i=>i.nodeMask)),
            bestIndividuals: compress(this.ga.bestIndividuals.map(i=>i.nodeMask)),
            bestCount: this.ga.bestIndividuals.length,
            parameters: this.ga.getParameters(),

            __fitnesses: this.ga.population.map(i=>i.fitness),
            __ages: this.ga.population.map(i=>i.age),
            children: []
        };
    }
    __guidGenerator() {
        var S4 = function() {
           return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        };
        return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
    }

}
function binaryMatrixToIndices(matrix) {
    let indices = [];
    for (let i = 0; i < matrix.length; i++) {
        indices.push([]);
        for (let j = 0; j < matrix[i].length; j++) {
            if (matrix[i][j] === 1) {
                indices[i].push(j);
            }
        }
    }
    return indices;
}

function indicesToBinaryMatrix(indices, cols) {
    let matrix = [];
    for (let i = 0; i < indices.length; i++) {
        matrix.push(Array(cols).fill(0));
        for (let j = 0; j < indices[i].length; j++) {
            matrix[i][indices[i][j]] = 1;
        }
    }
    return matrix;
}

function compress(matrix){
    const binaryString = matrix.flat().join(''); // Converte a matriz para string binária
    const compressed = zlib.gzipSync(binaryString); // Aplica Gzip
    return base64Data = compressed.toString('base64');
}

function decompress(compressed, rows, cols){
    let compressedBuffer = Buffer.from(compressed, 'base64'); // Decodifica Base64
    let binaryString = zlib.gunzipSync(compressedBuffer).toString(); // Descomprime Gzip

    return Array.from({ length: rows }, (_, i) =>
        binaryString.slice(i * cols, (i + 1) * cols).split('').map(Number));
}


// let binaryMatrix = [
//     [0, 1, 0, 1],
//     [1, 0, 1, 0],
//     [0, 1, 0, 1]
// ];
// let compressedMatrix = binaryMatrixToIndices(binaryMatrix);
// console.log("Matriz comprimida:", compressedMatrix);
// let restoredMatrix = indicesToBinaryMatrix(compressedMatrix, 4);
// console.log("Matriz restaurada:", restoredMatrix);





if (typeof module !== "undefined") module.exports = { TreeSaveModel };