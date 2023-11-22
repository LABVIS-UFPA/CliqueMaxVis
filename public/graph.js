class Graph {
  constructor() {
    this.adj = {};
    this.nodes = [];
    this.nodesByKey = {};
    this.links = [];
  }

  addNode(id) {
    if (this.nodesByKey[id]) return; //Caso o vértice já exista não faz nada.
    let n = { id: id };
    this.nodes.push(n);
    this.nodesByKey[id] = n;
    this.adj[id] = {};
  }

  addLink(source, target, originalLink) {

    //Se os vértices não existem, adiciona os vértices antes de adicionar a aresta.
    if(!this.adj[source]) this.addNode(source);
    if(!this.adj[target]) this.addNode(target);

    if(this.adj[source][target] || this.adj[target][source]) return; // Se a aresta já existe, não faz nada.
    
    let l = {
      source, target, originalLink
    }
    this.links.push(l);
    this.adj[source][target] = this.adj[target][source] = l;
  }

  getAdjs(node) {
    return Object.values(this.adj[node.id]).map(l=>l.source===node.id?l.target:l.source);
  }

  getLinkByNodes(n0,n1){
    return this.adj[n0.id][n1.id];
  }

  getNodeDegree(node) {
    return Object.keys(this.adj[node.id]).length;
  }


}

function calculateCompleteGraph() {
  const completeGraph = new Graph();
  for (let i = 1; i <= graph.nodes.length; i++) {
    completeGraph.addNode(i);
  }

  for (let i = 1; i <= graph.nodes.length; i++) {
    for (let j = i + 1; j <= graph.nodes.length; j++) {
      const existingLink = graph.links.find(
        (link) =>
          (link.source === i && link.target === j) ||
          (link.source === j && link.target === i)
      );

      if (existingLink) {
        completeGraph.addLink(i, j, existingLink.originalLink);
      } else {
        completeGraph.addLink(i, j, false);
      }
    }
  }
  graph = completeGraph;
}


class CliqueSolver{
  constructor(graph) {
    this.graph = graph;
  }

  branchAndBound(){
    function permutacoes(array) {
      function backtrack(inicio) {
        if (inicio === array.length - 1) {
          resultados.push([...array]); // Copia a permutação atual para o resultado
          return;
        }
    
        for (let i = inicio; i < array.length; i++) {
          // Troca os elementos para gerar a permutação
          [array[inicio], array[i]] = [array[i], array[inicio]];
          
          // Chama recursivamente para o restante da permutação
          backtrack(inicio + 1);
    
          // Desfaz a troca para voltar ao estado anterior
          [array[inicio], array[i]] = [array[i], array[inicio]];
        }
      }
    
      const resultados = [];
      backtrack(0);
      return resultados;
    }
    let branch = (order) => {
      let cliqueBuilder = new CliqueBuilder(this.graph);
      for(let n of order){
        cliqueBuilder.addNode(n);
      }
      return cliqueBuilder.clique;
    }

    let max = [];
    let perm = permutacoes(this.graph.nodes);
    for(let t of perm){
      let maximal = branch(t);
      if(max.length<maximal.length){
        max = maximal;
      }
    }
    return max;
  }
}

class CliqueBuilder{

  constructor(graph){
    this.graph = graph;
    this.clique = [];
  }

  addNode(node){
    if(this.clique.length>0){
      for(let ci of this.clique) if(!this.graph.getLinkByNodes(ci,node)) return; //Se não existe ligação com os já existentes, então não adiciona o vértice.
    }
    this.clique.push(node);
  }
}
