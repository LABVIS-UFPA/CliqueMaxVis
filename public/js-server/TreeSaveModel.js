

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
        clonedNode.bestFitness = node.bestFitness;
        clonedNode.generation = node.generation;
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
        this.ga.setParameters(selected.parameters);
        this.ga.population = selected.population.map(i=>this.ga.newIndividual(i));
        this.ga.bestFitness = selected.bestFitness;
        this.ga.bestUpperBound = selected.bestUpperBound;
        this.ga.generation = selected.generation;
        this.ga.bestIndividuals = bestIndividuals;
    }
    __getModel(){
        return {
            id: this.__guidGenerator(),
            population: this.ga.population.map(i=>i.nodeMask),
            bestFitness: this.ga.bestFitness,
            bestUpperBound: this.ga.bestUpperBound,
            generation: this.ga.generation,
            bestIndividuals: this.ga.bestIndividuals,
            parameters: this.ga.getParameters(),
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

if (typeof module !== "undefined") module.exports = { TreeSaveModel };