class Graph {
  constructor() {
    this.adj = {};
    this.nodes = [];
    this.nodesByKey = {};
    this.links = [];
  }

  addNode(id) {
    if (!this.nodes.find((n) => n.id === id)) {
      this.nodes.push({ id });
      let n = { id: id };
      this.nodesByKey[id] = n;
      this.adj[id] = {};
    }
  }

  addLink(source, target, originalLink) {
    this.links.push({ source, target, originalLink });
    if (!this.nodes.find((n) => n.id === source)) {
      this.nodes.push({ id: source });
    }
    if (!this.nodes.find((n) => n.id === target)) {
      this.nodes.push({ id: target });
    }
  }

  getAdjs(node) {
    return this.links
      .filter(
        (link) => link.source.id === node.id || link.target.id === node.id
      )
      .map((link) => (link.source.id === node.id ? link.target : link.source));
  }

  getNodeDegree(node) {
    return this.links.filter(
      (link) => link.source.id === node.id || link.target.id === node.id
    ).length;
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
