const fs = require('fs');

// =========================
// Leitura DIMACS
// =========================
function readDimacs(path) {
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n');

  let N = 0;
  const edges = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('c')) continue;

    if (line.startsWith('p')) {
      const parts = line.split(/\s+/);
      N = parseInt(parts[2]);
    }

    if (line.startsWith('e')) {
      const parts = line.split(/\s+/);
      const u = parseInt(parts[1]) - 1;
      const v = parseInt(parts[2]) - 1;
      edges.push([u, v]);
    }
  }

  return { N, edges };
}

const { N, edges } = readDimacs('C:\\Users\\Akaz Marinho\\Documents\\Discover\\Mestrado\\Pesquisa\\CliqueMaxVis\\exemplosGrafos\\gen400_p0.9_65.clq.txt');

// =========================
// Grafo (matriz)
// =========================
function buildGraph(N, edges) {
  const adj = Array.from({ length: N }, () => Array(N).fill(0));

  for (const [u, v] of edges) {
    adj[u][v] = 1;
    adj[v][u] = 1;
  }

  return adj;
}

const adj = buildGraph(N, edges);

// =========================
// Grau
// =========================
function computeDegrees(adj, N) {
  return adj.map(row => row.reduce((a, b) => a + b, 0));
}

const degrees = computeDegrees(adj, N);

// =========================
// Operações no vetor binário
// =========================
function hasVertex(H, v) {
  return H[v] === 1;
}

function addVertex(H, v) {
  const H2 = [...H];
  H2[v] = 1;
  return H2;
}

function removeVertex(H, v) {
  const H2 = [...H];
  H2[v] = 0;
  return H2;
}

// =========================
// Fitness
// =========================
function fitness(H) {
  return H.reduce((a, b) => a + b, 0);
}

// =========================
// Auxiliar
// =========================
function getCandidatesFromAdjRow(row) {
  const list = [];
  for (let i = 0; i < row.length; i++) {
    if (row[i]) list.push(i);
  }
  return list;
}

// =========================
// Construção de solução
// =========================
function randomClique(adj, N) {
  let v = Math.floor(Math.random() * N);
  let H = Array(N).fill(0);
  H[v] = 1;

  let candidates = getCandidatesFromAdjRow(adj[v]);

  while (candidates.length > 0) {
    let u = candidates[Math.floor(Math.random() * candidates.length)];
    H[u] = 1;

    candidates = candidates.filter(x => adj[u][x] === 1);
  }

  return H;
}

function extend(H, adj, N) {
  let candidates = [...Array(N).keys()].filter(v => H[v] === 0);

  candidates = candidates.filter(v =>
    H.every((h, i) => h === 0 || adj[i][v] === 1)
  );

  while (candidates.length > 0) {
    candidates.sort((a, b) => degrees[b] - degrees[a]);
    let v = candidates[0];

    H[v] = 1;

    candidates = candidates.filter(x => adj[v][x] === 1);
  }

  return H;
}

function repair(H, adj, N) {
  for (let i = 0; i < N; i++) {
    if (!H[i]) continue;

    for (let j = 0; j < N; j++) {
      if (H[j] && i !== j && adj[i][j] === 0) {
        H[j] = 0;
      }
    }
  }
  return H;
}

// =========================
// Harmony Search
// =========================
function initializeHM(HMS, adj, N) {
  const HM = [];

  for (let i = 0; i < HMS; i++) {
    let H = randomClique(adj, N);
    H = extend(H, adj, N);
    HM.push(H);
  }

  return HM;
}

function newHarmony(HM, HMCR, P, N) {
  let H = Array(N).fill(0);

  for (let i = 0; i < N; i++) {
    if (Math.random() < HMCR) {
      let r = Math.floor(Math.random() * HM.length);
      if (HM[r][i]) H[i] = 1;
    } else {
      if (Math.random() < P) H[i] = 1;
    }
  }

  return H;
}

function generateValidHarmony(HM, HMCR, P, adj, N) {
  let H = newHarmony(HM, HMCR, P, N);
  H = repair(H, adj, N);
  H = extend(H, adj, N);
  return H;
}

function findWorstIndex(HM) {
  let worstIndex = 0;
  let worstFitness = fitness(HM[0]);

  for (let i = 1; i < HM.length; i++) {
    let f = fitness(HM[i]);
    if (f < worstFitness) {
      worstFitness = f;
      worstIndex = i;
    }
  }

  return worstIndex;
}

function updateHM(HM, H_new) {
  let worstIndex = findWorstIndex(HM);

  if (fitness(H_new) > fitness(HM[worstIndex])) {
    HM[worstIndex] = H_new;
  }
}

function localSearch(H, adj, N) {
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 0; i < N; i++) {
      if (!H[i]) continue;

      let H2 = removeVertex(H, i);
      H2 = extend(H2, adj, N);

      if (fitness(H2) > fitness(H)) {
        H = H2;
        improved = true;
        break;
      }
    }
  }

  return H;
}

// =========================
// Parâmetros adaptativos
// =========================
function updateParameters(iter, MAX_ITERS) {
  const progress = iter / MAX_ITERS;

  const HMCR = 0.7 + (0.95 - 0.7) * progress;
  const P = 0.4 - (0.4 - 0.1) * progress;

  return { HMCR, P };
}

// =========================
// Loop principal
// =========================
function harmonySearch(adj, N, HMS, HMCR, P, MAX_ITERS) {
  let HM = initializeHM(HMS, adj, N);

  let best = HM[0];

  for (let i = 1; i < HM.length; i++) {
    if (fitness(HM[i]) > fitness(best)) {
      best = HM[i];
    }
  }

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const params = updateParameters(iter, MAX_ITERS);

    let H_new = generateValidHarmony(HM, params.HMCR, params.P, adj, N);
    H_new = localSearch(H_new, adj, N);

    updateHM(HM, H_new);

    if (fitness(H_new) > fitness(best)) {
      best = H_new;
    }
  }

  return best;
}

// =========================
// Execução
// =========================
const HMS = 10;
const HMCR = 0.9;
const P = 0.3;
const MAX_ITERS = 1000;

for (let i = 0; i < 5; i++) {
  const best = harmonySearch(adj, N, HMS, HMCR, P, MAX_ITERS);
  console.log("Run", i, "Clique:", fitness(best));
}