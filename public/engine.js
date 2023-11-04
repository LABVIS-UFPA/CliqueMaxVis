let showOriginalLinks = true;
let showNodeDegrees = true;
let showGreyLinks = true;
let showGreyNodes = true;
let showIDTooltip = true;
let showMatrix = true;
let nodeElements;
let linkElements;
let lineX;
let graph;
let leftNodes = [];
let arr;
let regex = /\ne\s(\d+)\s(\d+)/g;
let lastGreenCount;
let lastBlueCount;
let lastGreyCount;
let lastRedCount;
let greenCount;
let redCount;
let blueCount;
let greyCount;
const IDtooltip = d3.select("#IDtooltip");

function readFile() {
  const [file] = document.querySelector("#inputFile").files;
  const reader = new FileReader();
  reader.addEventListener(
    "load",
    () => {
      let text = reader.result;
      graph = new Graph();
      while ((arr = regex.exec(text)) !== null) {
        graph.addLink(+arr[1], +arr[2], true);
      }

      init();
    },
    false
  );

  if (file) {
    reader.readAsText(file);
  }
}

function switchGraph() {
  showOriginalLinks = !showOriginalLinks;
  switchLinks();
  updateNodeTextValues();
  updateVertexColors();
  updateLinkColors();
}

function switchLinks() {
  const linkElements = d3.selectAll(".link");
  linkElements.style("display", function (d) {
    if (showOriginalLinks) {
      if (d.originalLink) {
        return "inline";
      } else {
        return "none";
      }
    } else {
      if (d.originalLink) {
        return "none";
      } else {
        return "inline";
      }
    }
  });
}

function loadMenu() {
  const originalArestasCount = graph.links.filter((link) => link.originalLink)
    .length;
  const complementarArestasCount = graph.links.filter(
    (link) => !link.originalLink
  ).length;

  document.getElementById("Arestas").innerHTML = `
    <strong>Grafo Apresentado:</strong> ${
      showOriginalLinks ? "Original" : "Complementar"
    } <br><br>
    <strong>Nº Arestas<br>Originais:</strong> ${originalArestasCount} <br><br>
    <strong>Nº Arestas Complementares:</strong> ${complementarArestasCount} <br><br>
  `;
  document.getElementById("buttonsDiv").classList.remove("hidden");
  document.getElementById("buttonsDiv").classList.add("visible");

  document.getElementById("switchGraphBTN").innerHTML = `${
    showOriginalLinks ? "Mostrar Grafo Complementar" : "Mostrar Grafo Original"
  }`;

  document.getElementById("leftNodesCount").classList.remove("hidden");
  document.getElementById("leftNodesCount").classList.add("visible");
}

function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
    mouseout();
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
    updateVertexColors();
    updateLinkColors();
    updateNodeTextValues();
    mouseout();
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = d.x;
    d.fy = d.y;

    clickCounter(d);
    updateVertexColors();
    updateLinkColors();
    updateNodeTextValues();
    mouseover(event, d);
    document.getElementById("fakeNodes").classList.remove("hidden");
    document.getElementById("fakeNodes").classList.add("visible");
    updateLastNodeCounts()
  }

  const dragBehavior = d3
    .drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);

  nodeElements = d3.selectAll(".node");
  nodes = nodeElements.data();
  linkElements = d3.selectAll(".link");
  links = linkElements.data();

  nodeElements.call(dragBehavior);

  return dragBehavior;
}

function clickCounter() {
  graph.nodes.forEach((d) => {
    const isNodeInLeftNodes = leftNodes.includes(d);

    if (d.x < lineX) {
      if (!isNodeInLeftNodes) {
        leftNodes.push(d);
      }
    } else {
      if (isNodeInLeftNodes) {
        const index = leftNodes.indexOf(d);
        leftNodes.splice(index, 1);
      }
    }
  });

  const uniqueLeftNodes = [...new Set(leftNodes)];
  const areAnyRedNodesInLeft = uniqueLeftNodes.some(
    (node) => node.fill === "red"
  );
  const leftNodesCountText = document.getElementById("leftNodesCount");

  leftNodesCountText.textContent = `Clique de Tamanho: ${
    areAnyRedNodesInLeft ? "-" : `${uniqueLeftNodes.length}`
  }`;
}
function updateVertexColors() {
  const lineX = window.innerWidth * 0.7 * 0.4;
  const leftVertices = nodes.filter((d) => d.x < lineX);

  nodes.forEach((d) => {
    if (d.x < lineX) {
      if (showOriginalLinks) {
        const connectedOriginalLinks = links.filter(
          (link) =>
            (link.source === d || link.target === d) && link.originalLink
        );
        const allConnectedToLeft = leftVertices.every((leftVertex) => {
          if (d !== leftVertex) {
            return connectedOriginalLinks.some(
              (link) =>
                (link.source === d && link.target === leftVertex) ||
                (link.source === leftVertex && link.target === d)
            );
          }
          return true;
        });

        if (allConnectedToLeft) {
          d.fill = "green";
        } else {
          d.fill = "red";
        }
      } else {
        const connectedOriginalLinks = links.filter(
          (link) =>
            (link.source === d || link.target === d) && !link.originalLink
        );
        const connectedToAnyLeft = connectedOriginalLinks.some((link) => {
          return leftVertices.some(
            (vertex) =>
              (link.source === d && link.target === vertex) ||
              (link.source === vertex && link.target === d)
          );
        });

        if (connectedToAnyLeft) {
          d.fill = "red";
        } else {
          d.fill = "green";
        }
      }
    } else {
      const connectedOriginalLinks = links.filter(
        (link) => (link.source === d || link.target === d) && !link.originalLink
      );
      const hasConnectedGreenVertex = connectedOriginalLinks.some((link) => {
        return leftVertices.some(
          (vertex) => link.source === vertex || link.target === vertex
        );
      });

      if (hasConnectedGreenVertex) {
        d.fill = "#ccc";
      } else {
        d.fill = "blue";
      }
    }
  });

  nodeElements.attr("fill", (d) => d.fill);
  nodeElements
    .selectAll("circle, text")
    .style("display", (d) =>
      d.fill === "#ccc" && !showGreyNodes ? "none" : "inline"
    );
  updateNodeCounts();
}

function updateLastNodeCounts() {
  document.getElementById(
    "lastGreenNodeCount"
    ).textContent = lastGreenCount;
  document.getElementById(
    "lastBlueNodeCount"
    ).textContent = lastBlueCount;
  document.getElementById(
      "lastGreyNodeCount"
    ).textContent = lastGreyCount;
  document.getElementById(
    "lastRedNodeCount"
    ).textContent = lastRedCount;

  lastGreenCount = greenCount;
  lastBlueCount = blueCount;
  lastGreyCount = greyCount;
  lastRedCount = redCount;
}

function updateNodeCounts() {
  greenCount = nodes.filter((d) => d.fill === "green")?.length;
  redCount = nodes.filter((d) => d.fill === "red")?.length;
  blueCount = nodes.filter((d) => d.fill === "blue")?.length;
  greyCount = nodes.filter((d) => d.fill === "#ccc")?.length;

  document.getElementById(
    "greenNodeCount"
    ).textContent = greenCount;
  document.getElementById(
    "blueNodeCount"
    ).textContent = blueCount;
  document.getElementById(
      "greyNodeCount"
    ).textContent = greyCount;
  document.getElementById(
    "redNodeCount"
    ).textContent = redCount;
}

function updateLinkColors() {
  linkElements.attr("stroke", function (d) {
    const source = d.source;
    const target = d.target;

    const allRightVertices = nodes.every(
      (vertex) => vertex.fill === "blue" || vertex.fill === "#ccc"
    );

    if (showOriginalLinks) {
      if (allRightVertices) {
        return showGreyLinks ? "grey" : "none";
      } else if (
        (source.fill === "green" && target.fill === "green") ||
        (source.fill === "green" && target.fill === "blue") ||
        (source.fill === "blue" && target.fill === "green")
      ) {
        return "green";
      } else if (source.fill === "blue" && target.fill === "blue") {
        return "blue";
      } else {
        const sourceOnLeft = source.x < lineX;
        const targetOnLeft = target.x < lineX;
        if (sourceOnLeft && targetOnLeft) {
          return "green";
        }
        return showGreyLinks ? "grey" : "none";
      }
    } else {
      if (allRightVertices) {
        return showGreyLinks ? "grey" : "none";
      } else if (
        (source.fill === "green" && target.fill === "green") ||
        (source.fill === "green" && target.fill === "blue") ||
        (source.fill === "blue" && target.fill === "green")
      ) {
        return "green";
      } else if (source.fill === "blue" && target.fill === "blue") {
        return "red";
      } else if (source.fill === "red" && target.fill === "red") {
        return "red";
      } else {
        return showGreyLinks ? "grey" : "none";
      }
    }
  });
}

function updateNodeTextValues() {
  nodeElements.each(function (nodeData) {
    const node = d3.select(this);
    const leftNodes = nodes.filter((d) => d.x < lineX);
    
    if (leftNodes.length > 0) {
      const greenAndBlueStrokes = d3.selectAll(".link").filter(function (d) {
        const sourceId = d.source.id;
        const targetId = d.target.id;

        if (showOriginalLinks) {
          return (
            (sourceId === nodeData.id || targetId === nodeData.id) &&
            d.originalLink &&
            ((d.source.fill === "green" || d.source.fill === "blue") && (d.target.fill === "green" || d.target.fill === "blue"))
          );
        } else {
          return (
            (sourceId === nodeData.id || targetId === nodeData.id) &&
            !d.originalLink &&
            ((d.source.fill === "green" || d.source.fill === "blue") && (d.target.fill === "green" || d.target.fill === "blue"))
          );
        }
      });
      node.select("text").text(greenAndBlueStrokes.size());
    } else {
      const connectedStrokes = d3.selectAll(".link").filter(function (d) {
        const sourceId = d.source.id;
        const targetId = d.target.id;

        if (showOriginalLinks) {
          return (
            (sourceId === nodeData.id || targetId === nodeData.id) &&
            d.originalLink
          );
        } else {
          return (
            (sourceId === nodeData.id || targetId === nodeData.id) &&
            !d.originalLink
          );
        }
      });
      node.select("text").text(connectedStrokes.size());
    }
  });
  hideNodeCount();
}

function switchDegrees() {
  showNodeDegrees = !showNodeDegrees;
  hideNodeCount();
}

function hideNodeCount() {
  const textElements = d3.selectAll(".node text");
  textElements.style("display", function () {
    if (showNodeDegrees) {
      return "inline";
    } else {
      return "none";
    }
  });
}

function toggleGreyLinks() {
  showGreyLinks = !showGreyLinks;
  updateLinkColors();
}

function toggleGreyNodes() {
  showGreyNodes = !showGreyNodes;
  updateVertexColors();
}

function toggleIDTooltip() {
  showIDTooltip = !showIDTooltip;
}

function toggleMatrix() {
  showMatrix = !showMatrix;
  renderMatrix();
}

function mouseover(event, d) {
  if (showIDTooltip) {
    IDtooltip.style("display", "block")
      .style("left", event.x + 5 + "px")
      .style("top", event.y + 5 + "px")
      .html(`ID: ${d.id}`);
  } else {
    IDtooltip.style("display", "none");
  }
}

function mouseout() {
  IDtooltip.style("display", "none");
}

function init(){
  calculateCompleteGraph();
  renderGraph();
  loadMenu();
  switchLinks();
  renderMatrix();
  updateNodeTextValues();
}