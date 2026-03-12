let width;
let height;

function renderGraph() {
  width = window.innerWidth * 0.88;
  height = window.innerHeight * 0.93;

  const svg = d3
    .select("#graph")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const simulation = d3
    .forceSimulation(graph.nodes)
    .force("link",d3.forceLink(graph.links).id((d) => d.id))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width * 0.6, height / 2));

  const link = svg
    .selectAll(".link")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke", "#ccc")
    .attr("stroke-width", 1.5);

  const node = svg
    .selectAll(".node")
    .data(graph.nodes)
    .enter()
    .append("g")
    .attr("fill", "blue")
    .attr("class", "node")
    .call(drag(simulation));

  node
    .on("mouseover", mouseover)
    .on("mouseout", mouseout);

  node
    .append("circle")
    .attr("r", 14)
    .attr("stroke", "#fff")
    .attr("stroke-width", 1);

  node
    .append("text")
    .attr("dx", 0)
    .attr("dy", 5)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .attr("class", "node-text");

  lineX = innerWidth * 0.2;

  svg
    .append("line")
    .attr("class", "line-vertical")
    .attr("x1", lineX)
    .attr("y1", 0)
    .attr("x2", lineX)
    .attr("y2", height)
    .attr("stroke", "black")
    .attr("stroke-width", 1);

  let tickCount = 0;
  simulation.on("tick", () => {
    if (tickCount % 2 === 0 ) {
      graph.nodes.forEach(node => {
        node.x = Math.max(0, Math.min(width, node.x));
        node.y = Math.max(0, Math.min(height, node.y));
      });
    }

    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);

    tickCount++;
    if (tickCount >= 10) {
      simulation.force("link", null);
      simulation.force("charge", null);
      simulation.force("center", null);
    }
    if (tickCount === 1) {
      updateNodeTextValues();
      updateVertexColors();
      updateLinkColors();
    }
  });
}

function renderMatrix() {
  let matrixContainer = document.getElementById("matrix");
  if (!showMatrix) {
    matrixContainer.innerText = "";
  } else {
    matrixContainer.innerText = "";

    const nodeCount = graph.nodes.length;
    const matrix = Array.from(Array(nodeCount), () =>
      new Array(nodeCount).fill(0)
    );

    graph.links.forEach((link) => {
      const { source, target } = link;
      matrix[source.id - 1][target.id - 1] = 1;
      matrix[target.id - 1][source.id - 1] = 1;
    });
//verificar originalLink
    for (let i = 0; i < nodeCount; i++) {
      matrixContainer.innerHTML +=
        matrix[i]
          .map((val) => (val ? "<span style='color: blue;'>1</span>" : "0"))
          .join(" ") + "<br>";
    }
  }
}
