class Graph {
  constructor() {
    this.adj = {};
    this.nodes = [];
    this.nodesByKey = {};
    this.links = [];
  }

  addNode(id) {
    if (this.nodesByKey[id]) return; //Caso o vértice já exista não faz nada.
    let n = { id: id, index: this.nodes.length };
    this.nodes.push(n);
    this.nodesByKey[id] = n;
    this.adj[id] = {};
    // this.matAjd = [];
  }

  addLink(source, target, originalLink) {

    //Se os vértices não existem, adiciona os vértices antes de adicionar a aresta.
    if (!this.adj[source]) this.addNode(source);
    if (!this.adj[target]) this.addNode(target);

    if (this.adj[source][target] || this.adj[target][source]) return; // Se a aresta já existe, não faz nada.

    let l = {
      source, target, originalLink
    }
    this.links.push(l);
    this.adj[source][target] = this.adj[target][source] = l;
  }

  getAdjs(node) {
    return Object.values(this.adj[node.id]).map(l => l.source === node.id ? l.target : l.source);
  }

  getLinkByNodes(n0, n1) {
    return this.adj[n0.id][n1.id];
  }

  getNodeDegree(node) {
    return Object.keys(this.adj[node.id]).length;
  }

  importFromText(text) {
    let arr;
    let regex = /\ne\s(\d+)\s(\d+)/g;
    while ((arr = regex.exec(text)) !== null) {
      this.addLink(+arr[1], +arr[2], true);
    }
  }

  exportToText() {
    let ids = this.nodes.map(n => n.id);
    ids.sort((a, b) => (+a) - (+b));
    let text = `p edge ${this.nodes.length} ${this.links.length}`
    for (let i = 0; i < ids.length; i++) {
      for (let j = i; j < ids.length; j++) {
        if (this.adj[ids[i]][ids[j]]) text += `\ne ${ids[i]} ${ids[j]}`
      }
    }
    return text;
  }

  subGraph(filterNodes, filterLinks) {
    let subGraph = new Graph();
    const node_mask = [];
    for (let i = 0; i < this.nodes.length; i++) {
      node_mask.push(0);
      if (filterNodes(this.nodes[i], i)) {
        subGraph.addNode(this.nodes[i].id);
        node_mask[i] = 1;
      }
    }
    if (!filterLinks) filterLinks = l => {
      const si = this.nodesByKey[l.source].index;
      const ti = this.nodesByKey[l.target].index;
      if (node_mask[si] && node_mask[ti]) return true;
      else return false;
    }
    for (let i = 0; i < this.links.length; i++) {
      if (filterLinks(this.links[i], i)) {
        subGraph.addLink(this.links[i].source, this.links[i].target);
      }
    }
    return subGraph;
  }



  hasSameAdjs(node1, node2) {
    // if(this.getNodeDegree(node1)!==this.getNodeDegree(node2))
    //   return 0;

    let adjs1 = new Set(this.getAdjs(node1));
    let adjs2 = new Set(this.getAdjs(node2));

    let isAdj = false;
    if (this.adj[node1.id][node2.id]) {
      adjs1.delete(node2.id);
      adjs2.delete(node1.id);
      isAdj = true;
    }
    if (isAdj) return 1000;
    // let isEqual = [...adjs1].every((x) => adjs2.has(x));

    // return isEqual ? (isAdj? 2: 1) : 0;

    let intersect = [...adjs1].filter((x) => adjs2.has(x));
    return intersect.length;

  }



  calcMatAdjs() {
    this.matAjd = new Array(this.nodes.length);
    for (let i = 0; i < this.nodes.length; i++) {
      this.matAjd[i] = new Array(this.nodes.length);
      for (let j = 0; j < this.nodes.length; j++) {
        this.matAjd[i][j] = this.adj[this.nodes[i].id][this.nodes[j].id] ? 1 : 0;
      }
    }
  }

  /**
   * Antes de usar esse método, use o genMatAdjs()
   * 
   */
  getCommonAdjsByIndex(index0, index1) {
    let res = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.matAjd[index0][i] & this.matAjd[index1][i]) res.push(i);
    }
    return res
  }

  /**
   * Antes de usar esse método, use o genMatAdjs()
   * 
   */
  getCommonAdjsCountByIndex(index0, index1) {
    if (!this.matAjd[index0][index1]) return 0;
    let res = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.matAjd[index0][i] & this.matAjd[index1][i]) res++;
    }
    return res
  }

  calcSquareMat() {
    this.sqrMat = new Array(this.nodes.length);
    for (let i = 0; i < this.nodes.length; i++) {
      this.sqrMat[i] = new Array(this.nodes.length);
    }
    for (let i = 0; i < this.nodes.length; i++) {
      this.sqrMat[i][i] = 0;
      for (let j = +1; j < this.nodes.length; j++) {
        this.sqrMat[i][j] = this.getCommonAdjsCountByIndex(i, j);
        this.sqrMat[j][i] = this.sqrMat[i][j];
      }
    }
    return this.sqrMat;
  }

  sumSqrMat() {
    let res = new Array(this.nodes.length);
    for (let i = 0; i < this.nodes.length; i++) {
      let sum = 0;
      for (let j = 0; j < this.nodes.length; j++) {
        sum += this.sqrMat[i][j];
      }
      res[i] = (Math.sqrt(8 * sum + 1) + 1) / 2;
      this.nodes[i].sqrSum = res[i];
    }
    return res;
  }

  //TODO: fazer um algoritmo que ordene primeiro os vertices e depois coloque todas as aresta no fim do grafo.
  sortLinksByCliquesReverse(last = this.links.length - 1) {
    for (let i = 0; i < this.links.length; i++) {
      this.links[i].originalOrder = i;
    }
    let cliqueSizes = [];
    for (let i = last; i >= 0; i--) {
      let movei = i;
      let l = this.links[i];
      let subGraph = this.subGraph(n => true, (e, k) => { return k <= i });
      let clique = new CliqueBuilder(subGraph, { nodes: [l.source, l.target] });
      for (let j = i - 1; j >= 0; j--) {
        let newClique = new CliqueBuilder(subGraph, { nodes: [this.links[j].source, this.links[j].target] });
        if (clique.union(newClique, true)) {
          movei--;
          let l_aux = this.links[j];
          this.links[j] = this.links[movei];
          this.links[movei] = l_aux;
        }
      }
      cliqueSizes.push(i - (movei - 1));
      i = movei;
    }
    console.log(cliqueSizes);
    // console.log(this.links);
    return cliqueSizes;
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



class CliqueMask {
  constructor(graph, nodeMask) {
    this.graph = graph;
    if (!nodeMask) {
      this.nodeMask = graph.nodes.map(n => 1);
    } else {
      this.nodeMask = nodeMask;
    }
  }

  verifyClique() {
    let count = this.nodeMask.reduce((sum, bit) => sum + bit, 0);
    let nodes = this.graph.nodes;
    let numNodes = nodes.length;

    for (let i = 0; i < numNodes; i++) {
      for (let j = i + 1; j < numNodes; j++) {
        if (this.nodeMask[i] && this.nodeMask[j] && !this.graph.matAjd[i][j]) {
          if (count > 0) count = -1;
          else count--;
        }
      }
    }
    return count;
  }

  verifyInsertion(pos) {
    let nodes = this.graph.nodes;
    let numNodes = nodes.length;
    for (let i = 0; i < numNodes; i++) {
      if (this.nodeMask[i] && !this.graph.matAjd[i][pos]) return false;
    }
    return true;
  }

  isEqual(clique) {
    let numNodes = this.graph.nodes.length;
    for (let i = 0; i < numNodes; i++) {
      if (this.nodeMask[i] !== clique.nodeMask[i]) {
        return false;
      }
    }
    return true;
  }

  getConflicts() {
    const nodes = this.graph.nodes;
    const numNodes = nodes.length;
    const conflicts = [];

    for (let i = 0; i < numNodes; i++) {
      for (let j = i + 1; j < numNodes; j++) {
        if (this.nodeMask[i] && this.nodeMask[j] && !this.graph.matAjd[i][j]) {
          conflicts.push([i, j]);
        }
      }
    }
    return conflicts;
  }

  extraction() {
    const len = this.nodeMask.length;
    let i = 0;
    const conflicts = this.getConflicts();

    while (conflicts.length > 0) {
      i = Math.floor(Math.random() * this.nodeMask.length);
      while (!i) { i = (i + 1) % len; }
      for (let j = conflicts.length - 1; j >= 0; j--) {
        if (conflicts[j].indexOf(i) >= 0) conflicts.splice(j, 1);
      }
      this.nodeMask[i] = 0;
    }
    return this;
  }
  improvement() {
    const len = this.nodeMask.length;
    let i = Math.floor(Math.random() * len);
    let cont = 0;
    while (cont < len) {
      i = (i + 1) % len;
      cont++;
      if (this.verifyInsertion(i)) this.nodeMask[i] = 1;
    }
    return this;
  }

  getAuxiliaryUpperBound() {
    let colorCount = 0;
    let coloring = this.nodeMask.map(v => v ? colorCount++ : -1);
    const len = this.nodeMask.length;
    let i = Math.floor(Math.random() * len);
    let j = Math.floor(Math.random() * colorCount);
    let cont = 0;
    while (cont < len) {
      i = (i + 1) % len;
      cont++;
      if (coloring[i]<0){
        for(let k=0;k<colorCount;k++){
          
        }
      }
    }
  }

}

CliqueMask.getConstructor = (graph) => {
  return (nodeMask) => { return new CliqueMask(graph, nodeMask) }
}


class CliqueSolver {
  constructor(graph) {
    this.graph = graph;
  }

  setObserver(observer) {
    this.observer = observer;
  }

  bruteforce() {
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
      for (let n of order) {
        cliqueBuilder.addNode(n);
      }
      return cliqueBuilder.clique;
    }

    let max = [];
    let perm = permutacoes(this.graph.nodes);
    for (let t of perm) {
      let maximal = branch(t);
      if (max.length < maximal.length) {
        max = maximal;
      }
    }
    return max;
  }

  branchAndBound() {

    let bb = (cliqueBuilder, searchNodes) => {
      let maxclique = cliqueBuilder;



      let searchAux = searchNodes;
      for (let n of searchNodes) {
        let nextCB = new CliqueBuilder(this.graph, { cliqueBuilder });
        nextCB.clique.push(n);
        let nextSearch = searchAux.filter(v => { return v !== n && nextCB.checkAdd(v) });

        if (nextSearch.length + nextCB.clique.length <= maxclique.clique.length)
          continue;

        let returnedClique = bb(nextCB, nextSearch);
        if (returnedClique.len() > maxclique.len()) {
          maxclique = returnedClique;
        }
        searchAux = searchAux.filter(v => { return v !== n });

      }
      return maxclique;
    }

    return bb(new CliqueBuilder(this.graph), this.graph.nodes.map(n => n.id)).clique;

  }

  alg1() {
    let init = [];
    for (let l of this.graph.links) {
      init.push(new CliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    // console.log(init);


    while (true) {
      let result = [];
      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res)
            result.push(res);
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length}`);
      }
      if (this.observer) this.observer.end();

      result.sort((a, b) => b.clique.length - a.clique.length);
      if (result[0]) console.log(`max_clique_size(${result[0].clique.length})  candidates_len(${result.length})`);
      let newRes = []
      for (let i = 0; i < result.length; i++) {
        for (let j = result.length - 1; j > i; j--) {
          const res = result[i].subset(result[j], true);
          if (res)
            result.splice(j, 1);
        }
        if (this.observer) this.observer.log(`reduce => ${i + 1}/${result.length}`);
      }
      if (this.observer) this.observer.end();
      console.log(init.length, "para", result.length);
      if (result.length <= 0) break;
      init = result;
    }

    let max = Math.max.apply(null, init.map(v => v.clique.length));
    let max_cliques = init.filter(v => v.clique.length === max).map(v => v.clique);
    console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    return max_cliques;
  }

  alg2() {
    let init = [];
    for (let l of this.graph.links) {
      init.push(new CliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    // console.log(init);

    // let z=0
    while (true) {// while(z<2){
      // z++
      // let result = new CliqueTRIE(c=>c.clique);
      let result = [];
      let maxLen = -1;
      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            // result.add(res);
            // if(!result[res.clique.length]) result[res.clique.length] = [];
            if (res.clique.length > maxLen) maxLen = res.clique.length;

            if (res.clique.length === maxLen) result.unshift(res);
            else result.push(res);

          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length}`);
      }
      if (this.observer) this.observer.end();

      // result.sort((a, b) => b.clique.length - a.clique.length);
      // let res = result.getAllLeafs();
      console.log("expandiu para ", result.length);
      console.log(result);
      // if(result[0]) console.log(`max_clique_size(${result[0].clique.length})  candidates_len(${result.length})`);


      //remover os iguais
      let newi = 0;
      for (let i = 0; i < result.length; i++) {
        for (let j = result.length - 1; j > i; j--) {
          if (result[i].clique.length !== result[j].clique.length) {
            newi = j;
            continue;
          }
          const res = result[i].subset(result[j], true);
          if (res)
            result.splice(j, 1);
        }
        if (newi > i) i = newi;
        if (this.observer) this.observer.log(`reduce iguais => ${i + 1}/${result.length}`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < result.length; i++) {
        for (let j = result.length - 1; j > i; j--) {
          if (maxLen === result[j].clique.length) break;
          const res = result[i].subset(result[j], true);
          if (res)
            result.splice(j, 1);
        }
        if (this.observer) this.observer.log(`reduce => ${i + 1}/${result.length}`);
      }
      if (this.observer) this.observer.end();
      console.log("reduziu para ", result.length);
      // console.log(init.length, "para", result.length);
      if (result.length <= 0) break;
      init = result;
    }

    let max = Math.max.apply(null, init.map(v => v.clique.length));
    let max_cliques = init.filter(v => v.clique.length === max).map(v => v.clique);
    console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    return max_cliques;
  }


  alg3() {
    let init = [];
    for (let l of this.graph.links) {
      init.push(new CliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    // console.log(init);


    while (true) {
      let result = [];
      let maxLen = -1;
      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (res.clique.length === maxLen) //result.unshift(res);
              result.push(res);
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length}`);
      }
      if (this.observer) this.observer.end();

      // result.sort((a, b) => b.clique.length - a.clique.length);
      if (result[0]) console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      let newRes = []
      for (let i = 0; i < result.length; i++) {
        for (let j = result.length - 1; j > i; j--) {
          const res = result[i].subset(result[j], true);
          if (res)
            result.splice(j, 1);
        }
        if (this.observer) this.observer.log(`reduce => ${i + 1}/${result.length}`);
      }
      if (this.observer) this.observer.end();
      console.log(init.length, "para", result.length);
      if (result.length <= 0) break;
      init = result;
    }

    let max = Math.max.apply(null, init.map(v => v.clique.length));
    let max_cliques = init.filter(v => v.clique.length === max).map(v => v.clique);
    console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    return max_cliques;
  }


  alg4() {
    let init = [];
    for (let l of this.graph.links) {
      init.push(new SortedCliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    // console.log(init);


    while (true) {
      let result = [];
      let trie = new CliqueTRIE(c => c.clique);
      let maxLen = -1;
      let newCLiqueCount = 0;
      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (res.clique.length === maxLen) { //result.unshift(res);
              // result.push(res);
              if (trie.add(res)) newCLiqueCount++;
            }
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafs();
      // console.log(result);
      if (result[0]) console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


      // for (let i = 0; i < result.length; i++) {
      //   for (let j = result.length-1; j > i; j--) {
      //     const res = result[i].subset(result[j], true);
      //     if(res)
      //       result.splice(j,1);
      //   }
      //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
      // }
      if (this.observer) this.observer.end();
      console.log(init.length, "para", result.length);
      if (result.length <= 0) break;
      init = result;
    }

    let max = Math.max.apply(null, init.map(v => v.clique.length));
    let max_cliques = init.filter(v => v.clique.length === max).map(v => v.clique);
    console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    return max_cliques;
  }

  //Estável: retorna os maximais sem dividir
  alg5() {
    let finalRes = [];
    let init = [];
    for (let l of this.graph.links) {
      init.push(new SortedCliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    // console.log(init);

    let ultimoLen = -1;
    while (true) {
      let result = [];
      let trie = new CliqueTRIE(c => c.clique);
      let maxLen = -1;
      let newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      result = trie.getAllLeafs();
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      // console.log(result);
      if (this.observer) this.observer.end();
      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }

    //Retorna todos os cliques maximais.
    // let max = Math.max.apply(null,init.map(v=>v.clique.length));
    // let max_cliques = init.filter(v=>v.clique.length===max).map(v=>v.clique);
    // console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    for (let clique of init) {
      finalRes.push(clique);
    }
    return finalRes;
  }
  //Variação do alg acima para usar o sorted reduce
  alg5_2() {
    let finalRes = [];
    let init = [];
    for (let l of this.graph.links) {
      init.push(new SortedCliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    //remover verificação do cliqueTotal quando 
    let grafoCompleto = new SortedCliqueBuilder(this.graph);
    let isGrafoCompleto = true;
    for (let i = 0; i < init.length; i++) {
      if (!grafoCompleto.union(init[i], true)) {
        isGrafoCompleto = false;
        break;
      }
    }
    if (isGrafoCompleto) return [grafoCompleto];

    let ultimoLen = -1;
    while (true) {
      let result = [];
      let trie = new CliqueTRIE(c => c.clique);
      let maxLen = -1;
      let newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].fast_union(init[j]);//const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      result = trie.getAllLeafsSorted();
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      // console.log(result);
      if (this.observer) this.observer.end();

      this.__reduceCliquesSorted__(result);

      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }

    //Retorna todos os cliques maximais.
    // let max = Math.max.apply(null,init.map(v=>v.clique.length));
    // let max_cliques = init.filter(v=>v.clique.length===max).map(v=>v.clique);
    // console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    for (let clique of init) {
      finalRes.push(clique);
    }
    return finalRes;
  }

  //Estável: retorna os maximais dividindo em 2
  alg6() {
    let div = this.graph.links.length / 2;
    let subGraph1 = this.graph.subGraph(n => true, (e, i) => { return i < div })
    let subGraph2 = this.graph.subGraph(n => true, (e, i) => { return i >= div })



    let CS1 = new CliqueSolver(subGraph1);
    let res1 = CS1.alg5();
    console.log("subGraph1", res1[0].graph);

    let CS2 = new CliqueSolver(subGraph2);
    let res2 = CS2.alg5();
    console.log("subGraph2", res2[0].graph);


    let finalRes = [];


    let result = [];
    let trie = new CliqueTRIE(c => c.clique);
    let maxLen = -1;
    let newCLiqueCount = 0;
    let added1 = [];
    let added2 = [];
    let ultimoLen = -1;

    // console.log()

    for (let i = 0; i < res1.length; i++) {
      res1[i].graph = this.graph;
      res1[i].from = "subgraph1";
      added1[i] = false;
    }
    for (let i = 0; i < res2.length; i++) {
      res2[i].graph = this.graph;
      res2[i].from = "subgraph2";
      added2[i] = false;
    }

    this.__joinCliques__(res1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = added2[j] = true;
    });

    let min1 = this.__getMinimalCliques__(subGraph1.links);
    let min2 = this.__getMinimalCliques__(subGraph2.links);
    this.__joinCliques__(res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });
    this.__joinCliques__(min1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });

    //TODO: Verificar se fazer isso somente no fim e novamente o while é melhor.
    this.__joinCliques__(min1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      // added1[i] = true;
    });


    for (let i = 0; i < res1.length; i++) {
      if (!added1[i]) finalRes.push(res1[i]);
    }
    for (let i = 0; i < res2.length; i++) {
      if (!added2[i]) finalRes.push(res2[i]);
    }
    // result.sort((a, b) => b.clique.length - a.clique.length);
    result = trie.getAllLeafs();



    // //Verifica se já é subset. 
    // this.__joinCliques__(min1,min2,(res)=>{
    //   for(let r of result){
    //     if(r.subset(res)) return;
    //   }
    //   for(let r of finalRes){
    //     if(r.subset(res)) return;
    //   }
    //   result.push(res);
    // });

    // console.log(result);
    console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


    // for (let i = 0; i < result.length; i++) {
    //   for (let j = result.length-1; j > i; j--) {
    //     const res = result[i].subset(result[j], true);
    //     if(res)
    //       result.splice(j,1);
    //   }
    //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
    // }
    // console.log(result);
    if (this.observer) this.observer.end();
    // if(ultimoLen === result.length) break;
    let init = result;
    ultimoLen = result.length;


    //Fazer o subset avacalha a resposta... Porque?
    // for (let i = 0; i < init.length; i++) {
    //   for (let j = init.length-1; j > i; j--) {
    //     const res = init[i].subset(init[j], true);
    //     if(res)
    //     init.splice(j,1);
    //   }
    //   if(this.observer) this.observer.log(`reduce => ${i+1}/${init.length}`);
    // }


    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            // if(res.clique.length===maxLen){ //result.unshift(res);
            // result.push(res);
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
            // }
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafs();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


      // for (let i = 0; i < result.length; i++) {
      //   for (let j = result.length-1; j > i; j--) {
      //     const res = result[i].subset(result[j], true);
      //     if(res)
      //       result.splice(j,1);
      //   }
      //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
      // }
      console.log("result.length", result.length);
      if (this.observer) this.observer.end();
      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }

    //Retorna todos os cliques maximais.
    // let max = Math.max.apply(null,init.map(v=>v.clique.length));
    // let max_cliques = init.filter(v=>v.clique.length===max).map(v=>v.clique);
    // console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    for (let clique of init) {
      finalRes.push(clique);
    }
    return finalRes.sort((a, b) => { return b.clique.length - a.clique.length });


  }

  //Estável:  retorna os maximais dividindo em 2
  alg7() {
    let div = this.graph.links.length / 2; //Divisão igual
    // let div = 200; // Para ser recursivo modo desigual
    let subGraph1 = this.graph.subGraph(n => true, (e, i) => { return i < div })
    let subGraph2 = this.graph.subGraph(n => true, (e, i) => { return i >= div })
    console.log("div", div, this.graph.links.length);


    let CS1 = new CliqueSolver(subGraph1);
    // let res1 = div>500 ? CS1.alg7() : CS1.alg5(); // Para ser recursivo
    let res1 = CS1.alg5();
    console.log("subGraph1", res1[0].graph);

    let CS2 = new CliqueSolver(subGraph2);
    // let res2 = div>500 ? CS2.alg7() : CS2.alg5(); // Para ser recursivo
    // let res2 = subGraph2.links.length>div ? CS2.alg7() : CS2.alg5(); // Para ser recursivo modo desigual
    let res2 = CS2.alg5();
    console.log("subGraph2", res2[0].graph);


    let finalRes = [];


    let result = [];
    let trie = new CliqueTRIE(c => c.clique);
    let maxLen = -1;
    let newCLiqueCount = 0;
    let added1 = [];
    let added2 = [];
    let ultimoLen = -1;

    // console.log()

    for (let i = 0; i < res1.length; i++) {
      res1[i].graph = this.graph;
      res1[i].from = "subgraph1";
      added1[i] = false;
    }
    for (let i = 0; i < res2.length; i++) {
      res2[i].graph = this.graph;
      res2[i].from = "subgraph2";
      added2[i] = false;
    }

    this.__joinCliques__(res1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = added2[j] = true;
    });

    let min1 = this.__getMinimalCliques__(subGraph1.links);
    let min2 = this.__getMinimalCliques__(subGraph2.links);
    this.__joinCliques__(res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });
    this.__joinCliques__(min1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });


    for (let i = 0; i < res1.length; i++) {
      if (!added1[i]) finalRes.push(res1[i]);
    }
    for (let i = 0; i < res2.length; i++) {
      if (!added2[i]) finalRes.push(res2[i]);
    }
    // result.sort((a, b) => b.clique.length - a.clique.length);
    result = trie.getAllLeafs();



    // //Verifica se já é subset. 
    // this.__joinCliques__(min1,min2,(res)=>{
    //   for(let r of result){
    //     if(r.subset(res)) return;
    //   }
    //   for(let r of finalRes){
    //     if(r.subset(res)) return;
    //   }
    //   result.push(res);
    // });

    // console.log(result);
    console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


    // for (let i = 0; i < result.length; i++) {
    //   for (let j = result.length-1; j > i; j--) {
    //     const res = result[i].subset(result[j], true);
    //     if(res)
    //       result.splice(j,1);
    //   }
    //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
    // }
    // console.log(result);
    if (this.observer) this.observer.end();
    // if(ultimoLen === result.length) break;
    let init = result;
    ultimoLen = result.length;



    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            // if(res.clique.length===maxLen){ //result.unshift(res);
            // result.push(res);
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
            // }
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafs();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


      // for (let i = 0; i < result.length; i++) {
      //   for (let j = result.length-1; j > i; j--) {
      //     const res = result[i].subset(result[j], true);
      //     if(res)
      //       result.splice(j,1);
      //   }
      //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
      // }
      console.log("result.length", result.length);
      if (this.observer) this.observer.end();
      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }

    //Retorna todos os cliques maximais.
    // let max = Math.max.apply(null,init.map(v=>v.clique.length));
    // let max_cliques = init.filter(v=>v.clique.length===max).map(v=>v.clique);
    // console.log(`max_size(${max}) e num_of_cliques(${max_cliques.length})`)
    for (let clique of init) {
      finalRes.push(clique);
    }

    //A partir daqui. $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
    trie = new CliqueTRIE(c => c.clique);

    this.__joinCliques__(min1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      // added1[i] = true;
    });




    init = trie.getAllLeafs();
    console.log("########## aqui é o problema", init.length);
    console.log("########## já estamos aqui", finalRes.length)
    ultimoLen = finalRes.length;



    for (let i = 0; i < init.length; i++) {
      for (let j = init.length - 1; j > i; j--) {
        const res = init[i].subset(init[j], true);
        if (res)
          init.splice(j, 1);
      }
      if (this.observer) this.observer.log(`reduce => ${i + 1}/${init.length}`);
    }

    console.log("########## aqui é o problema 2", init.length);


    trie = new CliqueTRIE(c => c.clique);
    for (let clique of finalRes) {
      trie.add(clique);
    }
    for (let clique of init) {
      trie.add(clique);
    }

    init = trie.getAllLeafs();;
    ultimoLen = finalRes.length;
    finalRes = [];



    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            // if(res.clique.length===maxLen){ //result.unshift(res);
            // result.push(res);
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
            // }
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafs();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


      // for (let i = 0; i < result.length; i++) {
      //   for (let j = result.length-1; j > i; j--) {
      //     const res = result[i].subset(result[j], true);
      //     if(res)
      //       result.splice(j,1);
      //   }
      //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
      // }
      console.log("result.length", result.length);
      if (this.observer) this.observer.end();
      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }





    //%%%%%%%%%%%%%% FIM 
    // trie = new CliqueTRIE(c=>c.clique);
    // for (let clique of finalRes) {
    //   trie.add(clique);
    // }
    // for (let clique of subfinalRes) {
    //   trie.add(clique);
    // }

    // init = trie.getAllLeafs();;
    // ultimoLen = finalRes.length;
    // finalRes = [];


    // while(true){
    //   result = [];
    //   trie = new CliqueTRIE(c=>c.clique);
    //   maxLen = -1;
    //   newCLiqueCount = 0;
    //   let added = [];

    //   for (let i = 0; i < init.length; i++) {
    //     added[i] = false;
    //   }


    //   for (let i = 0; i < init.length; i++) {
    //     for (let j = i+1; j < init.length; j++) {
    //       const res = init[i].union(init[j]);
    //       if(res){
    //         if(res.clique.length>maxLen) maxLen=res.clique.length;
    //         // if(res.clique.length===maxLen){ //result.unshift(res);
    //           // result.push(res);
    //           if(trie.add(res)) newCLiqueCount++;
    //           added[i] = added[j] = true;
    //         // }
    //       }
    //     }
    //     if(this.observer) this.observer.log(`expand => ${i+1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
    //   }
    //   if(this.observer) this.observer.end();

    //   for (let i = 0; i < init.length; i++) {
    //     if(!added[i]) finalRes.push(init[i]);
    //   }
    //   // result.sort((a, b) => b.clique.length - a.clique.length);
    //   result = trie.getAllLeafs();
    //   // console.log(result);
    //   console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


    //   // for (let i = 0; i < result.length; i++) {
    //   //   for (let j = result.length-1; j > i; j--) {
    //   //     const res = result[i].subset(result[j], true);
    //   //     if(res)
    //   //       result.splice(j,1);
    //   //   }
    //   //   if(this.observer) this.observer.log(`reduce => ${i+1}/${result.length}`);
    //   // }
    //   console.log("result.length", result.length);
    //   if(this.observer) this.observer.end();
    //   if(ultimoLen === result.length) break;
    //   init = result;
    //   ultimoLen = result.length;
    // }


    return finalRes.sort((a, b) => { return b.clique.length - a.clique.length });


  }

  //TODO: ordenar os links para manter os cliques próximos
  alg7_2(onParcialSolve = () => { }, state = { cursor: Infinity, div: 50, resp: [] }, cursor = 0) {
    // let div = this.graph.links.length/2; //Divisão igual
    const explodeFactor = 50;
    let div = state.div; // Para ser recursivo modo desigual
    let subGraph1 = this.graph.subGraph(n => true, (e, i) => { return i < div })
    let subGraph2 = this.graph.subGraph(n => true, (e, i) => { return i >= div })
    console.log("div", div, this.graph.links.length);


    let CS1 = new CliqueSolver(subGraph1);
    CS1.setObserver(this.observer);
    // let res1 = div>500 ? CS1.alg7_2() : CS1.alg5(); // Para ser recursivo
    let res1 = CS1.alg5();
    console.log("subGraph1 res", res1.length);

    let CS2 = new CliqueSolver(subGraph2);
    CS2.setObserver(this.observer);
    // let res2 = div>500 ? CS2.alg7_2() : CS2.alg5(); // Para ser recursivo
    // let res2 = subGraph2.links.length>div ? CS2.alg7_2(cursor+div) : CS2.alg5(); // Para ser recursivo modo desigual
    // let res2 = CS2.alg5();
    let res2;
    if (cursor + div >= state.cursor)
      res2 = state.resp;
    else
      res2 = subGraph2.links.length > div ? CS2.alg7_2(onParcialSolve, state, cursor + div) : CS2.alg5();

    console.log("subGraph2  res.len(", res2.length, ")  links.len(", subGraph2.links.length, ")");


    let finalRes = [];


    let result = [];
    let trie = new CliqueTRIE(c => c.clique);
    let maxLen = -1;
    let newCLiqueCount = 0;
    let added1 = [];
    let added2 = [];
    let ultimoLen = -1;


    for (let i = 0; i < res1.length; i++) {
      res1[i].graph = this.graph;
      res1[i].from = "subgraph1";
      added1[i] = false;
    }
    for (let i = 0; i < res2.length; i++) {
      res2[i].graph = this.graph;
      res2[i].from = "subgraph2";
      added2[i] = false;
    }

    this.__joinCliques__(res1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = added2[j] = true;
    });

    let min1 = this.__getMinimalCliques__(subGraph1.links);
    let min2 = this.__getMinimalCliques__(subGraph2.links);

    this.__joinCliques__(res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });

    this.__joinCliques__(min1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });


    for (let i = 0; i < res1.length; i++) {
      if (!added1[i]) finalRes.push(res1[i]);
    }
    for (let i = 0; i < res2.length; i++) {
      if (!added2[i]) finalRes.push(res2[i]);
    }

    result = trie.getAllLeafs();



    console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


    this.__reduceCliques__(result);

    let init = result;
    ultimoLen = result.length;



    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafs();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      if (this.observer) this.observer.end();

      //Retirar se der problema
      if (result.length > explodeFactor) {
        this.__reduceCliques__(result);
      }

      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }


    for (let clique of init) {
      finalRes.push(clique);
    }

    //A partir daqui a solução mistura os mínimos das duas parcelas com os maximais abertos das soluções.

    let exp_res1 = [];
    for (let i = 0; i < res1.length; i++) {
      exp_res1.push(...res1[i].roll_back());
    }
    let exp_res2 = [];
    for (let i = 0; i < res2.length; i++) {
      exp_res2.push(...res2[i].roll_back());
    }

    trie = new CliqueTRIE(c => c.clique);
    this.__joinCliques__(exp_res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });

    this.__joinCliques__(min1, exp_res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });

    for (let clique of finalRes) {
      trie.add(clique);
    }

    init = trie.getAllLeafs();
    finalRes = [];

    this.__reduceCliques__(init);


    console.log("########## aqui é o problema", init.length);

    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) added[i] = false;

      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafs();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      if (this.observer) this.observer.end();

      if (result.length > explodeFactor) this.__reduceCliques__(result);

      if (result.length === 0) break;
      init = result;
      ultimoLen = result.length;
    }

    finalRes.sort((a, b) => { return b.clique.length - a.clique.length });

    console.log("cursor => ", cursor);
    onParcialSolve({ cursor, div, resp: finalRes });

    return finalRes;


  }

  //Teste com reduceSorted
  alg7_2_2(onParcialSolve = () => { }, state = { cursor: Infinity, div: 400, resp: [] }, cursor = 0) {
    // let div = this.graph.links.length/2; //Divisão igual
    const explodeFactor = 50;
    let div;
    if (state.div instanceof Array) {
      div = state.div.pop(); // Para ser recursivo modo desigual
      // div = div*(div-1)/2;
    } else {
      div = state.div;
    }
    let subGraph1 = this.graph.subGraph(n => true, (e, i) => { return i < div })
    let subGraph2 = this.graph.subGraph(n => true, (e, i) => { return i >= div })
    console.log("div", div, this.graph.links.length);


    let CS1 = new CliqueSolver(subGraph1);
    CS1.setObserver(this.observer);
    // let res1 = div>500 ? CS1.alg7_2() : CS1.alg5(); // Para ser recursivo
    let res1 = CS1.alg5_2();
    console.log("subGraph1 res", res1.length);

    let CS2 = new CliqueSolver(subGraph2);
    CS2.setObserver(this.observer);
    // let res2 = div>500 ? CS2.alg7_2() : CS2.alg5(); // Para ser recursivo
    // let res2 = subGraph2.links.length>div ? CS2.alg7_2(cursor+div) : CS2.alg5(); // Para ser recursivo modo desigual
    // let res2 = CS2.alg5();
    let res2;
    if (cursor + div >= state.cursor)
      res2 = state.resp;
    else
      res2 = subGraph2.links.length > div ? CS2.alg7_2_2(onParcialSolve, state, cursor + div) : CS2.alg5_2();

    console.log("subGraph2  res.len(", res2.length, ")  links.len(", subGraph2.links.length, ")");


    let finalRes = [];


    let result = [];
    let trie = new CliqueTRIE(c => c.clique);
    let maxLen = -1;
    let newCLiqueCount = 0;
    let added1 = [];
    let added2 = [];
    let ultimoLen = -1;


    for (let i = 0; i < res1.length; i++) {
      res1[i].graph = this.graph;
      res1[i].from = "subgraph1";
      added1[i] = false;
    }
    for (let i = 0; i < res2.length; i++) {
      res2[i].graph = this.graph;
      res2[i].from = "subgraph2";
      added2[i] = false;
    }

    this.__joinCliques__(res1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = added2[j] = true;
    });

    let min1 = this.__getMinimalCliques__(subGraph1.links);
    let min2 = this.__getMinimalCliques__(subGraph2.links);

    this.__joinCliques__(res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });

    this.__joinCliques__(min1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });


    for (let i = 0; i < res1.length; i++) {
      if (!added1[i]) finalRes.push(res1[i]);
    }
    for (let i = 0; i < res2.length; i++) {
      if (!added2[i]) finalRes.push(res2[i]);
    }

    result = trie.getAllLeafsSorted();



    console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


    this.__reduceCliquesSorted__(result);

    let init = result;
    ultimoLen = result.length;



    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].fast_union(init[j]);// const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafsSorted();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      if (this.observer) this.observer.end();

      //Retirar se der problema
      if (result.length > explodeFactor) {
        this.__reduceCliquesSorted__(result);
      }

      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }


    for (let clique of init) {
      finalRes.push(clique);
    }

    //A partir daqui a solução mistura os mínimos das duas parcelas com os maximais abertos das soluções.

    let exp_res1 = [];
    for (let i = 0; i < res1.length; i++) {
      exp_res1.push(...res1[i].roll_back());
    }
    let exp_res2 = [];
    for (let i = 0; i < res2.length; i++) {
      exp_res2.push(...res2[i].roll_back());
    }
    //TODO: reduce aqui....

    trie = new CliqueTRIE(c => c.clique);
    this.__joinCliques__(exp_res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });

    this.__joinCliques__(min1, exp_res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });

    for (let clique of finalRes) {
      trie.add(clique);
    }

    init = trie.getAllLeafsSorted();
    finalRes = [];

    this.__reduceCliquesSorted__(init);


    console.log("########## aqui é o problema", init.length);

    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) added[i] = false;

      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].fast_union(init[j]);//const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafsSorted();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      if (this.observer) this.observer.end();

      if (result.length > explodeFactor) this.__reduceCliquesSorted__(result);

      if (result.length === 0) break;
      init = result;
      ultimoLen = result.length;
    }

    // finalRes.sort((a,b)=>{return b.clique.length-a.clique.length});

    console.log("cursor => ", cursor);
    onParcialSolve({ cursor, div, resp: finalRes });

    return finalRes;


  }

  //Sem roll_back , volta para os mínimosXmínimos
  alg7_3(onParcialSolve = () => { }, state = { cursor: Infinity, div: 400, resp: [] }, cursor = 0) {
    // let div = this.graph.links.length/2; //Divisão igual
    const explodeFactor = 50;
    let div;
    if (state.div instanceof Array) {
      div = state.div.pop(); // Para ser recursivo modo desigual
      // div = div*(div-1)/2;
    } else {
      div = state.div;
    }
    let subGraph1 = this.graph.subGraph(n => true, (e, i) => { return i < div })
    let subGraph2 = this.graph.subGraph(n => true, (e, i) => { return i >= div })
    console.log("div", div, this.graph.links.length);


    let CS1 = new CliqueSolver(subGraph1);
    CS1.setObserver(this.observer);
    // let res1 = div>500 ? CS1.alg7_2() : CS1.alg5(); // Para ser recursivo
    let res1 = CS1.alg5_2();
    console.log("subGraph1 res", res1.length);

    let CS2 = new CliqueSolver(subGraph2);
    CS2.setObserver(this.observer);
    // let res2 = div>500 ? CS2.alg7_2() : CS2.alg5(); // Para ser recursivo
    // let res2 = subGraph2.links.length>div ? CS2.alg7_2(cursor+div) : CS2.alg5(); // Para ser recursivo modo desigual
    // let res2 = CS2.alg5();
    let res2;
    if (cursor + div >= state.cursor)
      res2 = state.resp;
    else
      res2 = subGraph2.links.length > div ? CS2.alg7_3(onParcialSolve, state, cursor + div) : CS2.alg5_2();

    console.log("subGraph2  res.len(", res2.length, ")  links.len(", subGraph2.links.length, ")");


    let finalRes = [];


    let result = [];
    let trie = new CliqueTRIE(c => c.clique);
    let maxLen = -1;
    let newCLiqueCount = 0;
    let added1 = [];
    let added2 = [];
    let ultimoLen = -1;


    for (let i = 0; i < res1.length; i++) {
      res1[i].graph = this.graph;
      res1[i].from = "subgraph1";
      added1[i] = false;
    }
    for (let i = 0; i < res2.length; i++) {
      res2[i].graph = this.graph;
      res2[i].from = "subgraph2";
      added2[i] = false;
    }

    this.__joinCliques__(res1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = added2[j] = true;
    });

    let min1 = this.__getMinimalCliques__(subGraph1.links);
    let min2 = this.__getMinimalCliques__(subGraph2.links);

    this.__joinCliques__(res1, min2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added1[i] = true;
    });

    this.__joinCliques__(min1, res2, (res, i, j) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      added2[j] = true;
    });


    for (let i = 0; i < res1.length; i++) {
      if (!added1[i]) finalRes.push(res1[i]);
    }
    for (let i = 0; i < res2.length; i++) {
      if (!added2[i]) finalRes.push(res2[i]);
    }

    result = trie.getAllLeafsSorted();



    console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);


    // this.__reduceCliquesSorted__(result);
    result = this.__reduceCliquesSorted2__(result);

    let init = result;
    ultimoLen = result.length;



    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) {
        added[i] = false;
      }


      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].fast_union(init[j]);// const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalRes.push(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafsSorted();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      if (this.observer) this.observer.end();

      //Retirar se der problema
      if (result.length > explodeFactor) {
        // this.__reduceCliquesSorted__(result);
        result = this.__reduceCliquesSorted2__(result);
      }

      if (ultimoLen === result.length) break;
      init = result;
      ultimoLen = result.length;
    }


    for (let clique of init) {
      finalRes.push(clique);
    }

    //A partir daqui a solução mistura os mínimos com os mínimos.

    trie = new CliqueTRIE(c => c.clique);

    console.log("Join mínimos com mínimos.")
    this.__joinCliques__(min1, min2, (res) => {
      if (res.clique.length > maxLen) maxLen = res.clique.length;
      if (trie.add(res)) newCLiqueCount++;
      // added1[i] = true;
    });





    init = trie.getAllLeafsSorted();
    // finalRes = [];

    // this.__reduceCliquesSorted__(init);
    init = this.__reduceCliquesSorted2__(init);

    let finalTRIE = new CliqueTRIE(c => c.clique);
    for (let c of finalRes) finalTRIE.add(c);

    console.log("########## aqui é o problema", init.length);

    while (true) {
      result = [];
      trie = new CliqueTRIE(c => c.clique);
      maxLen = -1;
      newCLiqueCount = 0;
      let added = [];

      for (let i = 0; i < init.length; i++) added[i] = false;

      for (let i = 0; i < init.length; i++) {
        for (let j = i + 1; j < init.length; j++) {
          const res = init[i].fast_union(init[j]);//const res = init[i].union(init[j]);
          if (res) {
            if (res.clique.length > maxLen) maxLen = res.clique.length;
            if (trie.add(res)) newCLiqueCount++;
            added[i] = added[j] = true;
          }
        }
        if (this.observer) this.observer.log(`expand => ${i + 1}/${init.length} max_clique_size(${maxLen}) newCLiques(${newCLiqueCount})`);
      }
      if (this.observer) this.observer.end();

      for (let i = 0; i < init.length; i++) {
        if (!added[i]) finalTRIE.add(init[i]);
      }
      // result.sort((a, b) => b.clique.length - a.clique.length);
      result = trie.getAllLeafsSorted();
      // console.log(result);
      console.log(`max_clique_size(${maxLen})  candidates_len(${result.length})`);
      if (this.observer) this.observer.end();

      if (result.length > explodeFactor) {
        result = this.__reduceCliquesSorted2__(result);
        //  this.__reduceCliquesSorted__(result);
      }
      if (result.length === 0) break;
      init = result;
      ultimoLen = result.length;
    }

    finalRes = finalTRIE.getAllLeafsSorted();
    // finalRes = [];

    // this.__reduceCliquesSorted__(finalRes);
    finalRes = this.__reduceCliquesSorted2__(finalRes);
    // finalRes.sort((a,b)=>{return b.clique.length-a.clique.length});

    console.log("cursor => ", cursor);
    onParcialSolve({ cursor, div, resp: finalRes });

    return finalRes;


  }

  alg8() {
    let g = this.graph;
    let arr = new Array(g.nodes.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i;
    }

    // let start = [0, 1, 3, 4];
    // let start = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 15];// max 28 => [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 18, 34, 38, 40, 44, 51, 56, 61, 62, 72, 90, 97, 98, 99, 106, 118] 
    let start = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10]; // max (29) [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17, 18, 20, 34, 38, 40, 44, 62, 72, 79, 88, 90, 97, 98, 99, 102, 106, 118]
    // let start = [0, 1, 3, 4, 5, 6, 7, 23, 79, 101]
    // let start = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18];
    // let start = [44, 62, 69, 103];

    // for(let i=begin;i<arr.length-(23-start.length);i++){
    //   for(let j=i+1;j<arr.length-(22-start.length);j++){
    //     if(g.getLinkByNodes(g.nodes[i], g.nodes[j]))
    //       // && g.getLinkByNodes(g.nodes[0], g.nodes[j])
    //       // && g.getLinkByNodes(g.nodes[i], g.nodes[0]))
    //       mat.push(start.concat(i,j));
    //   }
    // }
    let result = [start];
    for (let i = 0; i < 19; i++)
      result = this.__nextSize__(result, Math.max(28 - start.length - i, 0));
    // result = this.__nextSize__(result, 22-start.length);
    // result = this.__nextSize__(result, 21-start.length);
    // result = this.__nextSize__(result);


    console.log(result);
    console.log(result[0]);
  }


  alg9() {
    let g = this.graph;
    let arr = new Array(g.nodes.length);
    let leg = 0;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = -1;
    }

    arr[0] = 0;
    let i = 0;
    let maxi = 1;
    let maxs = [];
    while (arr[i] < arr.length) {

      let ins = false;
      let next = arr[i];
      while (i < arr.length - 1 && next < arr.length - 1 && arr.length - 1 - next + i >= maxi) {
        // console.log(arr, arr.length-1-next+i>=maxi,arr.length-1-next+i, maxi )
        next++;


        // console.log("entra no 1 while", "i", i, "next", next);
        ins = true;
        for (let j = 0; j <= i; j++) {
          if (!g.getLinkByNodes(g.nodes[next], g.nodes[arr[j]])) {
            ins = false;
            break;
          }
        }
        if (!ins) {
          // i--;
          // break;
          continue;
        }

        i++;
        arr[i] = next;
        if (i > maxi) {
          maxi = i;
          maxs = [arr.slice(0, i + 1)];
        } else if (i === maxi) {
          maxs.push(arr.slice(0, i + 1))
        }
        // console.log(arr.slice(0,i+1), "insere");
      }


      //Movimenta o último elemento para frente, quando termina move o i para tras

      next = arr[i];
      ins = false;
      while (!ins) {

        next++;
        // console.log("i",i, "next", next);
        // console.log(arr, next>=arr.length, arr.length-1-next+i<maxi,arr.length-1-next+i, maxi)
        if (next >= arr.length || arr.length - next + i < maxi) {

          arr[i] = -1;
          i--;
          next = arr[i];
          if (i < 0) break;
          continue;
        }
        ins = true;
        for (let j = 0; j < i; j++) {
          if (!g.getLinkByNodes(g.nodes[next], g.nodes[arr[j]])) {
            ins = false;
            break;
          }
        }
        if (ins) {
          arr[i] = next;
          // console.log(arr.slice(0,i+1), "movimenta", "i",i);
        } else {
          next++;
        }
        // console.log("fim do while", arr);
      }
      // console.log(arr.slice(0,i+1), "saiu do while", arr.length);
      leg++;
      if (leg > 10000000) {
        leg = 0;
        if (this.observer) this.observer.log(`[ max(${maxi + 1}), arr=${arr.slice(0, i + 1)} ]`);
      }

    }

    if (this.observer) this.observer.end();
    console.log(`maximos: (${maxs.length})`);
    console.log(maxs);
    console.log(`max(${maxi + 1})`);
    return maxs.map(clique => clique.map(v => g.nodes[v].id));;

  }


  //Estável melhor alg. vamos tentar melhorar mais no 11
  alg10() {
    let g = this.graph;
    let arr = new Array(g.nodes.length);
    let leg = 0;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = -1;
    }

    let forward_adjs = new Array(g.nodes.length);
    let moves = new Array(g.nodes.length);
    let counts = new Array(g.nodes.length);
    for (let i = 0; i < g.nodes.length; i++) {
      moves[i] = 0;
      counts[i] = 0;
      forward_adjs[i] = [];
      for (let j = i + 1; j < g.nodes.length; j++) {
        if (g.adj[g.nodes[i].id][g.nodes[j].id])
          forward_adjs[i].push(j);
      }
    }

    let memo = new Array(g.nodes.length);
    let memo_start = new Array(g.nodes.length);
    for (let i = 0; i < memo.length; i++) {
      memo[i] = new Array(g.nodes.length);
      memo_start[i] = new Array(g.nodes.length);
      counts[i] = 0;
      for (let j = 0; j < memo.length; j++) {
        memo[i][j] = 0;
        if (i > j) {
          memo_start[i][j] = 0;
        } else {
          memo_start[i][j] = memo[i][j] = g.adj[g.nodes[i].id][g.nodes[j].id] ? 1 : 0;
        }
      }
    }
    // console.log(forward_adjs);
    // console.log(memo_start);

    // arr[0]=arr.length-1; //=>para ir de trás para frente.
    arr[0] = 0; //=> para ir normal
    let i = 0;
    let maxi = 0;
    let maxs = [];

    for (let j = arr[i] + 1; j < memo[i].length; j++) {
      memo[i][j] = memo_start[arr[i]][j];
      if (memo[i][j]) counts[i]++;
    }


    while (i >= 0) {
      let next = forward_adjs[arr[i]][moves[arr[i]]];
      moves[arr[i]]++;
      // console.log(arr[i], next);

      //TODO: tem coisa errada no count.
      while (next && counts[i] + i >= maxi) {
        // console.log(arr, arr.length-1-next+i>=maxi,arr.length-1-next+i, maxi )
        // console.log(arr, next, counts[i]+i);
        //Escolhe o próximo para ser adicionado.
        while (!memo[i][next]) {
          if (moves[arr[i]] < forward_adjs[arr[i]].length && counts[i] + i >= maxi) { //&& counts[i]){
            // counts[i]--;
            // if(counts[i]<0) console.log("neg", i,arr[i], arr, moves, counts);
            next = forward_adjs[arr[i]][moves[arr[i]]];
            moves[arr[i]]++;
          } else {
            next = -1;
            break;
          }
        }
        if (next < 0) break;

        //Acabou de selecionar um próximo válido, remove da contagem.
        counts[i]--;
        i++;
        arr[i] = next;
        next = forward_adjs[arr[i]][moves[arr[i]]];
        moves[arr[i]]++;

        //atualiza a memo e o counts
        counts[i] = 0;
        for (let j = arr[i] + 1; j < memo[i].length; j++) {
          memo[i][j] = memo[i - 1][j] & memo_start[arr[i]][j];
          if (memo[i][j]) counts[i]++;
        }

        // console.log(i,arr[i], arr, moves, counts);
        //Verifica se é o máximo e atualiza.
        if (i > maxi) {
          maxi = i;
          maxs = [arr.slice(0, i + 1)];
        } else if (i === maxi) {
          maxs.push(arr.slice(0, i + 1))
        }
        // console.log(arr.slice(0,i+1), "insere");
        // console.log("arr",arr);
      }

      //reinicia o movimento do vértice, pois ele já foi visitado.
      moves[arr[i]] = 0;

      //Quando o i chega em zero move para frente caso contrário, move o i para tras
      if (i === 0) {
        arr[i]++;
        // arr[i]--; //=>para ir de trás para frente.
        if (arr[i] >= arr.length) break;
        // if(arr[i]<0) break; //=>para ir de trás para frente.

        counts[i] = 0;
        for (let j = arr[i] + 1; j < memo[i].length; j++) {
          memo[i][j] = memo_start[arr[i]][j];
          if (memo[i][j]) counts[i]++;
        }
      } else {
        arr[i] = -1;
        i--;
      }


      leg++;
      if (leg > 50000000) {
        leg = 0;
        if (this.observer) this.observer.log(`[ max(${maxi + 1}), arr=${arr.slice(0, i + 1)} ]`);
      }

    }

    if (this.observer) this.observer.end();
    console.log(`maximos: (${maxs.length})`);
    console.log(maxs);
    console.log(`max(${maxi + 1})`);

    return maxs.map(clique => clique.map(v => g.nodes[v].id));

  }

  //Mesmo do 10, mas de tras pra frente aproveitando o clique max anterior
  alg11() {

    //Inicializações.
    //#region
    let g = this.graph;
    let arr = new Array(g.nodes.length);
    let leg = 0;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = -1;
    }

    let maxi = new Array(g.nodes.length);
    let maxs = new Array(g.nodes.length);;

    let forward_adjs = new Array(g.nodes.length);
    let moves = new Array(g.nodes.length);
    let counts = new Array(g.nodes.length);
    for (let i = 0; i < g.nodes.length; i++) {

      maxi[i] = 0;
      maxs[i] = [[i]];

      moves[i] = 0;
      counts[i] = 0;
      forward_adjs[i] = [];
      for (let j = i + 1; j < g.nodes.length; j++) {
        if (g.adj[g.nodes[i].id][g.nodes[j].id])
          forward_adjs[i].push(j);
      }
    }

    let memo = new Array(g.nodes.length);
    let memo_start = new Array(g.nodes.length);
    for (let i = 0; i < memo.length; i++) {
      memo[i] = new Array(g.nodes.length);
      memo_start[i] = new Array(g.nodes.length);
      counts[i] = 0;
      for (let j = 0; j < memo.length; j++) {
        memo[i][j] = 0;
        if (i > j) {
          memo_start[i][j] = 0;
        } else {
          memo_start[i][j] = memo[i][j] = g.adj[g.nodes[i].id][g.nodes[j].id] ? 1 : 0;
        }
      }
    }
    // console.log(forward_adjs);
    // console.log(memo_start);

    arr[0] = arr.length - 1; //=>para ir de trás para frente.
    // arr[0]=0; //=> para ir normal
    let i = 0;


    for (let j = arr[i] + 1; j < memo[i].length; j++) {
      memo[i][j] = memo_start[arr[i]][j];
      if (memo[i][j]) counts[i]++;
    }

    //#endregion

    while (i >= 0) {
      let next = forward_adjs[arr[i]][moves[arr[i]]];
      moves[arr[i]]++;
      // console.log(arr[i], next);

      //Vai adicionando até encontrar um maximal.
      while (next && counts[i] + i >= maxi[arr[0]]) {

        //Escolhe o próximo para ser adicionado dentro dos possíveis.
        while (!memo[i][next]) {
          if (moves[arr[i]] < forward_adjs[arr[i]].length && counts[i] + i >= maxi[arr[0]]) { //&& counts[i]){
            // counts[i]--;
            // if(counts[i]<0) console.log("neg", i,arr[i], arr, moves, counts);
            next = forward_adjs[arr[i]][moves[arr[i]]];
            moves[arr[i]]++;
          } else {
            next = -1;
            break;
          }
        }
        if (next < 0) break;

        //Acabou de selecionar um próximo válido, remove da contagem.
        counts[i]--;
        i++;
        arr[i] = next;

        // console.log("arr",arr);

        //Tentativa de quebrar pelos cliques máximos anteriores.
        //#region
        //Se o clique máximo do próximo mais a posição atual é menor que o maior conhecido, break.
        if (maxi[arr[i]] + i < maxi[arr[0]]) {
          // console.log("deu break");
          break;
        } else {
          // console.log("entrou na igualdade", maxi,maxi[arr[i]]+i, maxi[arr[0]]);
          // console.log(maxs);
          let match = false;
          let max_aux = [];
          for (let clique of maxs[arr[i]]) {
            let matchi = true;
            for (let ci of clique) {
              if (!memo[i - 1][ci]) {
                matchi = false;
                break;
              }
            }
            if (matchi) {
              match = true;
              // console.log("Clique bateu");
              let aux = arr.slice(0, i);
              aux.push(...clique);
              max_aux.push(aux);
            }
          }
          // console.log(max_aux);
          if (maxi[arr[i]] + i === maxi[arr[0]]) {
            if (match) maxs[arr[0]].push(...max_aux);
            // console.log("deu break");
            break;
          } else {
            if (match) {
              maxi[arr[0]] = maxi[arr[i]] + i;
              maxs[arr[0]] = max_aux;
              // console.log("deu break");
              break;
            }
          }

        }
        //#endregion


        //atualiza a memo e o counts
        counts[i] = 0;
        for (let j = arr[i] + 1; j < memo[i].length; j++) {
          memo[i][j] = memo[i - 1][j] & memo_start[arr[i]][j];
          if (memo[i][j]) counts[i]++;
        }


        //Verifica se é o máximo e atualiza.
        if (i > maxi[arr[0]]) {
          maxi[arr[0]] = i;
          maxs[arr[0]] = [arr.slice(0, i + 1)];
        } else if (i === maxi[arr[0]]) {
          maxs[arr[0]].push(arr.slice(0, i + 1));
        }

        //Pega o próximo e vai reinicia o loop.
        next = forward_adjs[arr[i]][moves[arr[i]]];
        moves[arr[i]]++;
        // console.log(i,arr[i], arr, moves, counts);

        // console.log(arr.slice(0,i+1), "insere");
        // console.log("arr",arr);
      }

      //reinicia o movimento do vértice, pois ele já foi visitado.
      moves[arr[i]] = 0;

      //Quando o i chega em zero move para frente caso contrário, move o i para tras
      if (i === 0) {
        // arr[i]++; //=>para ir normal.
        arr[i]--; //=>para ir de trás para frente.
        // if(arr[i]>=arr.length) break;
        if (arr[i] < 0) break; //=>para ir de trás para frente.

        counts[i] = 0;
        for (let j = arr[i] + 1; j < memo[i].length; j++) {
          memo[i][j] = memo_start[arr[i]][j];
          if (memo[i][j]) counts[i]++;
        }
      } else {
        arr[i] = -1;
        i--;
      }


      leg++;
      if (leg > 5000000) {
        leg = 0;
        if (this.observer) this.observer.log(`[ max(${Math.max(...maxi) + 1}), arr=${arr.slice(0, i + 1)} ]`);
      }

    }

    let max = Math.max(...maxi) + 1;
    let res = maxs.reduce((prev, curr) => { if (curr[0].length === max) { prev.push(...curr) } return prev; }, []);
    if (this.observer) this.observer.end();
    console.log(`maximos: (${res.length})`);
    console.log(res);
    console.log(`max(${max})`);

    return res.map(clique => clique.map(v => g.nodes[v].id));

  }

  //Mesmo do 11, mas só realiza a verificação do clique para a igualdade.
  alg12() {

    //Inicializações.
    //#region
    let g = this.graph;
    let arr = new Array(g.nodes.length);
    let leg = 0;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = -1;
    }

    let maxi = new Array(g.nodes.length);
    let maxs = new Array(g.nodes.length);;

    let forward_adjs = new Array(g.nodes.length);
    let moves = new Array(g.nodes.length);
    let counts = new Array(g.nodes.length);
    for (let i = 0; i < g.nodes.length; i++) {

      maxi[i] = 0;
      maxs[i] = [[i]];

      moves[i] = 0;
      counts[i] = 0;
      forward_adjs[i] = [];
      for (let j = i + 1; j < g.nodes.length; j++) {
        if (g.adj[g.nodes[i].id][g.nodes[j].id])
          forward_adjs[i].push(j);
      }
    }

    let memo = new Array(g.nodes.length);
    let memo_start = new Array(g.nodes.length);
    for (let i = 0; i < memo.length; i++) {
      memo[i] = new Array(g.nodes.length);
      memo_start[i] = new Array(g.nodes.length);
      counts[i] = 0;
      for (let j = 0; j < memo.length; j++) {
        memo[i][j] = 0;
        if (i > j) {
          memo_start[i][j] = 0;
        } else {
          memo_start[i][j] = memo[i][j] = g.adj[g.nodes[i].id][g.nodes[j].id] ? 1 : 0;
        }
      }
    }
    // console.log(forward_adjs);
    // console.log(memo_start);

    arr[0] = arr.length - 1; //=>para ir de trás para frente.
    // arr[0]=0; //=> para ir normal
    let i = 0;


    for (let j = arr[i] + 1; j < memo[i].length; j++) {
      memo[i][j] = memo_start[arr[i]][j];
      if (memo[i][j]) counts[i]++;
    }

    //#endregion

    while (i >= 0) {
      let next = forward_adjs[arr[i]][moves[arr[i]]];
      moves[arr[i]]++;
      // console.log(arr[i], next);

      //Vai adicionando até encontrar um maximal.
      while (next && counts[i] + i >= maxi[arr[0]]) {

        //Escolhe o próximo para ser adicionado dentro dos possíveis.
        while (!memo[i][next]) {
          if (moves[arr[i]] < forward_adjs[arr[i]].length && counts[i] + i >= maxi[arr[0]]) { //&& counts[i]){
            // counts[i]--;
            // if(counts[i]<0) console.log("neg", i,arr[i], arr, moves, counts);
            next = forward_adjs[arr[i]][moves[arr[i]]];
            moves[arr[i]]++;
          } else {
            next = -1;
            break;
          }
        }
        if (next < 0) break;

        //Acabou de selecionar um próximo válido, remove da contagem.
        counts[i]--;
        i++;
        arr[i] = next;

        // console.log("arr",arr);

        //Tentativa de quebrar pelos cliques máximos anteriores.
        //#region
        //Se o clique máximo do próximo mais a posição atual é menor que o maior conhecido, break.
        if (maxi[arr[i]] + i < maxi[arr[0]]) {
          // console.log("deu break");
          break;
        } else if (maxi[arr[i]] + i === maxi[arr[0]]) {
          // console.log("entrou na igualdade", maxi,maxi[arr[i]]+i, maxi[arr[0]]);
          // console.log(maxs);
          for (let clique of maxs[arr[i]]) {
            let matchi = true;
            for (let ci of clique) {
              if (!memo[i - 1][ci]) {
                matchi = false;
                break;
              }
            }
            if (matchi) {
              // console.log("Clique bateu");
              let aux = arr.slice(0, i);
              aux.push(...clique);
              maxs[arr[0]].push(aux);
            }
          }
          break;
        }
        //#endregion


        //atualiza a memo e o counts
        counts[i] = 0;
        for (let j = arr[i] + 1; j < memo[i].length; j++) {
          memo[i][j] = memo[i - 1][j] & memo_start[arr[i]][j];
          if (memo[i][j]) counts[i]++;
        }


        //Verifica se é o máximo e atualiza.
        if (i > maxi[arr[0]]) {
          maxi[arr[0]] = i;
          maxs[arr[0]] = [arr.slice(0, i + 1)];
        } else if (i === maxi[arr[0]]) {
          maxs[arr[0]].push(arr.slice(0, i + 1));
        }

        //Pega o próximo e vai reinicia o loop.
        next = forward_adjs[arr[i]][moves[arr[i]]];
        moves[arr[i]]++;
        // console.log(i,arr[i], arr, moves, counts);

        // console.log(arr.slice(0,i+1), "insere");
        // console.log("arr",arr);
      }

      //reinicia o movimento do vértice, pois ele já foi visitado.
      moves[arr[i]] = 0;

      //Quando o i chega em zero move para frente caso contrário, move o i para tras
      if (i === 0) {
        // arr[i]++; //=>para ir normal.
        arr[i]--; //=>para ir de trás para frente.
        // if(arr[i]>=arr.length) break;
        if (arr[i] < 0) break; //=>para ir de trás para frente.

        counts[i] = 0;
        for (let j = arr[i] + 1; j < memo[i].length; j++) {
          memo[i][j] = memo_start[arr[i]][j];
          if (memo[i][j]) counts[i]++;
        }
      } else {
        arr[i] = -1;
        i--;
      }


      leg++;
      if (leg > 1000000) {
        leg = 0;
        if (this.observer) this.observer.log(`[ max(${Math.max(...maxi) + 1}), arr=${arr.slice(0, i + 1)} ]`);
      }

    }

    let max = Math.max(...maxi) + 1;
    let res = maxs.reduce((prev, curr) => { if (curr[0].length === max) { prev.push(...curr) } return prev; }, []);
    if (this.observer) this.observer.end();
    console.log(`maximos: (${res.length})`);
    console.log(res);
    console.log(`max(${max})`);

    return res.map(clique => clique.map(v => g.nodes[v].id));

  }

  __nextSize__(mat, reduce) {
    let mat2 = [];
    let g = this.graph;
    for (let line of mat) {
      let begin = line[line.length - 1] + 1;
      for (let i = begin; i < g.nodes.length - reduce; i++) {
        let ins = true;
        for (let n of line) {
          if (!g.nodes[i]) console.log(i);
          if (!g.getLinkByNodes(g.nodes[i], g.nodes[n])) {
            ins = false;
            break;
          }
        }
        if (ins) mat2.push(line.concat(i))
      }
    }
    return mat2;
  }

  __reduceCliquesSorted2__(cliques) {
    let result = [];
    if (cliques.length === 0) return result;
    let resGraph = cliques[0].graph.subGraph(() => true, () => false);
    let auxGraph;

    console.log(cliques);
    for (let i = 0; i < cliques.length; i++) {
      auxGraph = cliques[i].graph;
      cliques[i].graph = resGraph;
      if (!cliques[i].isValid()) {
        result.push(cliques[i]);
        let c = cliques[i].clique;
        for (let k = 0; k < c.length; k++) {
          for (let j = k + 1; j < c.length; j++) {
            resGraph.addLink(c[k], c[j]);
          }
        }
      }
      cliques[i].graph = auxGraph;
      if (this.observer) this.observer.log(`reduce => ${i + 1}/${cliques.length} to ${result.length}`);
    }
    if (this.observer) this.observer.end();
    return result;

  }
  __reduceCliquesSorted__(cliques) {
    for (let i = 0; i < cliques.length; i++) {
      for (let j = cliques.length - 1; cliques[j].clique.length !== cliques[i].clique.length; j--) {
        const res = cliques[i].fast_subset(cliques[j]);// const res = cliques[i].subset(cliques[j], true);
        if (res) cliques.splice(j, 1);
      }
      if (this.observer) this.observer.log(`reduce => ${i + 1}/${cliques.length}`);
    }
    if (this.observer) this.observer.end();
  }
  __reduceCliques__(cliques) {
    for (let i = 0; i < cliques.length; i++) {
      for (let j = cliques.length - 1; j > i; j--) {
        if (cliques[i].clique.length === cliques[j].clique.length) continue;
        const res = cliques[i].subset(cliques[j], true);
        if (res) cliques.splice(j, 1);
      }
      if (this.observer) this.observer.log(`reduce => ${i + 1}/${cliques.length}`);
    }
    if (this.observer) this.observer.end();
  }
  __joinCliques__(cliques1, cliques2, resCallback) {
    for (let i = 0; i < cliques1.length; i++) {
      for (let j = 0; j < cliques2.length; j++) {
        const res = cliques1[i].fast_union(cliques2[j]);// const res = cliques1[i].union(cliques2[j]);
        if (res) {
          resCallback(res, i, j);
        }
      }
      if (this.observer) this.observer.log(`joinCliques => ${i + 1}/${cliques1.length}`);
    }
    if (this.observer) this.observer.end();
  }
  __getMinimalCliques__(links) {
    let cliques = [];
    for (let l of links) {
      cliques.push(new SortedCliqueBuilder(this.graph, { nodes: [l.source, l.target] }));
    }
    return cliques;
  }
}

class CliqueBuilder {

  constructor(graph, init = {}) {
    this.graph = graph;
    this.clique = [];
    if (init.cliqueBuilder)
      for (let n of init.cliqueBuilder.clique) this.clique.push(n);
    if (init.nodes)
      for (let n of init.nodes) this.clique.push(n);
  }

  checkAdd(node) {
    for (let ci of this.clique)
      if (!this.graph.adj[ci][node])
        return false; //Não existe ligação entre esse node e algum nó já existente nesse clique

    return true; // Tem ligação com todos.
  }

  addNode(node) {
    if (this.clique.length > 0) {
      for (let ci of this.clique) if (!this.graph.getLinkByNodes(ci, node)) return false; //Se não existe ligação com os já existentes, então não adiciona o vértice.
    }
    this.clique.push(node);
    return true;
  }

  roll_back() {
    let cliqueBuilders = [];
    for (let i = 0; i < this.clique.length; i++) {
      const nodes = [];
      for (let j = 0; j < this.clique.length; j++) {
        if (this.clique[j] !== this.clique[i]) nodes.push(this.clique[j])
      }
      cliqueBuilders.push(new this.constructor(this.graph, { nodes }));
    }
    return cliqueBuilders;
  }


  union(cliqueBuilder, mergeIn = false) {
    let merged = new Set(this.clique);
    for (let n of cliqueBuilder.clique) {
      for (let n2 of this.clique) {
        if (!this.graph.adj[n][n2] && n !== n2) return;
      }
      merged.add(n);
    }
    if (mergeIn) {
      this.clique = [...merged];
      return true;
    }
    return new CliqueBuilder(this.graph, { nodes: [...merged] });

  }

  subset(cliqueBuilder, mergeIn = false) {
    let setA = new Set(this.clique);
    let setB = new Set(cliqueBuilder.clique);
    if (this.clique.length < cliqueBuilder.clique.length) {
      const setAux = setA;
      setA = setB;
      setB = setAux;
    }
    for (const elem of setB) {
      if (!setA.has(elem)) {
        return false;
      }
    }
    if (mergeIn) {
      this.clique = [...setA];
      return true;
    }
    return [...setA];
  }

  isValid() {
    for (let i = 0; i < this.clique.length; i++) {
      for (let j = i + 1; j < this.clique.length; j++) {
        if (!this.graph.adj[this.clique[i]][this.clique[j]])
          return false;
      }
    }
    return true;
  }

  isMaximal() {
    let nodes = this.graph.nodes.map(n => n.id);
    for (let n of nodes) {
      if (this.clique.indexOf(n) >= 0) continue;
      if (this.checkAdd(n)) return false;
    }
    return true;
  }

  len() {
    return this.clique.length;
  }


  toModel() {
    return { clique: this.clique, name: this.constructor.name };
  }


  static fromModel(model, graph) {
    return new CliqueBuilder.BuilderTypes[model.name](graph, { nodes: model.clique });
  }
}


class SortedCliqueBuilder extends CliqueBuilder {

  constructor(graph, init = {}) {
    super(graph, init);
    this.sortFunction = (a, b) => a - b;
    this.sort();
  }

  addNode(node) {
    const res = super.addNode(node);
    this.sort();
    this.keys[node] = true;
    return res;
  }

  union(cliqueBuilder, mergeIn = false) {
    const res = super.union(cliqueBuilder, mergeIn);
    if (mergeIn) {
      this.sort();
      delete this.keys;
    } else if (res) {
      return new SortedCliqueBuilder(this.graph, { nodes: res.clique });
    }
    return res;
  }

  fast_union(cliqueBuilder, mergeIn = false) {
    if (!this.keys) {
      this.keys = {};
      for (let k of this.clique) this.keys[k] = true;
    }
    for (let n of cliqueBuilder.clique) {
      if (this.keys[n]) continue;
      for (let n2 of this.clique) {
        if (!this.graph.adj[n][n2] && n !== n2) return;
      }
    }
    let merged = new Set(this.clique);
    for (let n of cliqueBuilder.clique)
      merged.add(n);
    if (mergeIn) {
      this.clique = [...merged];
      delete this.keys;
      return true;
    }
    return new this.constructor(this.graph, { nodes: [...merged] });

  }


  subset(cliqueBuilder, mergeIn = false) {
    const res = super.subset(cliqueBuilder, mergeIn);
    if (mergeIn) { this.sort(); delete this.keys }
    return res;
  }

  fast_subset(cliqueBuilder) {
    if (!this.keys) {
      this.keys = {};
      for (let k of this.clique) this.keys[k] = true;
    }
    for (let k of cliqueBuilder.clique)
      if (!this.keys[k])
        return false;
    return true;
  }

  sort() {
    this.clique.sort(this.sortFunction);
  }
}

CliqueBuilder.BuilderTypes = {
  "CliqueBuilder": CliqueBuilder,
  "SortedCliqueBuilder": SortedCliqueBuilder
}


class CliqueTRIE {

  constructor(accessor = (c) => c) {
    this.root = {};
    this.a = accessor;
  }

  add(clique, node, index) {
    let c = this.a(clique);
    if (node) {
      if (c.length <= index) {
        if (!node.value) {
          node.value = clique;
          return true; //clique inserido;
        }
        return false;
      }
      if (!node[c[index]]) {
        node[c[index]] = {};
      }
      return this.add(clique, node[c[index]], index + 1);
    } else {
      return this.add(clique, this.root, 0);
    }
  }


  remove(clique, node, index) {
    let c = this.a(clique);
    if (node) {
      if (c.length <= index) {
        delete node.value;
        return true; //clique inserido;
      }
      if (!node[c[index]]) {
        return;
      }
      this.remove(clique, node[c[index]], index + 1);

      if (!Object.entries(node[c[index]]).length) delete node[c[index]];
    } else {
      this.remove(clique, this.root, 0);
    }
  }

  has(clique, node, index) {
    let c = this.a(clique);
    if (node) {
      if (c.length <= index) {
        if (node.value) return true; //clique encontrado;
        return false;
      }
      if (!node[c[index]]) {
        return false;
      }
      return this.has(clique, node[c[index]], index + 1);
    } else {
      return this.has(clique, this.root, 0);
    }
  }

  hasWithErr(clique, err, node, index) {
    let c = this.a(clique);
    if (node) {
      if (index === err) index++;
      if (c.length <= index) {
        if (node.value) return true; //clique encontrado;
        return false;
      }
      if (!node[c[index]]) {
        return false;
      }
      return this.hasWithErr(clique, err, node[c[index]], index + 1);
    } else {
      return this.hasWithErr(clique, err, this.root, 0);
    }
  }

  getAllLeafs(arr = [], node) {

    if (node) {
      let keys = Object.keys(node).filter(a => a !== "value");
      if (keys.length === 0 && node.value) { //é folha
        arr.push(node.value);
        return;
      }

      for (let k of keys) {
        this.getAllLeafs(arr, node[k]);
      }

    } else {
      this.getAllLeafs(arr, this.root);
      return arr;
    }
    // Object.entries(this.root)
  }

  getAllLeafsSorted(arr = new OrderedArray(cb => this.a(cb).length), node) {

    if (node) {
      let keys = Object.keys(node).filter(a => a !== "value");
      if (keys.length === 0 && node.value) { //é folha
        arr.insert(node.value);
        return;
      }

      for (let k of keys) {
        this.getAllLeafsSorted(arr, node[k]);
      }

    } else {
      this.getAllLeafsSorted(arr, this.root);
      return arr.array;
    }
    // Object.entries(this.root)
  }


}

class OrderedArray {

  constructor(accessor = e => e) {
    this.array = [];
    this.accessor = accessor;
  }

  insert(e, init = 0, end = this.array.length) {
    if (end - init <= 0) {
      this.array.splice(init, 0, e);
      return;
    } else if (end - init === 1) {
      this.array.splice(end, 0, e);
      return;
    }
    let mid = ((end - init) >> 1) + init;
    let dif = this.accessor(this.array[mid]) - this.accessor(e);
    if (dif === 0) {
      this.array.splice(mid, 0, e);
    } else {
      if (this.accessor(this.array[init]) <= this.accessor(e)) {
        this.array.splice(init, 0, e);
      } else if (this.accessor(this.array[end - 1]) >= this.accessor(e)) {
        this.array.splice(end, 0, e);
      } else if (dif < 0) {
        this.insert(e, init, mid);
      } else {
        this.insert(e, mid, end);
      }
    }

  }

  get length() {
    return this.array.length;
  }
}

if (typeof module !== "undefined") module.exports = { Graph, CliqueBuilder, CliqueSolver, CliqueMask };