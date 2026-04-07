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

    if (line.length === 0) continue;
    if (line.startsWith('c')) continue;

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
// Grafo
// =========================
function buildGraph(N, edges) {
  const adj = Array(N).fill(0n);

  for (const [u, v] of edges) {
    adj[u] |= (1n << BigInt(v));
    adj[v] |= (1n << BigInt(u));
  }

  return adj;
}

const adj = buildGraph(N, edges);

// =========================
// Grau
// =========================
function computeDegrees(adj, N) {
  const deg = new Array(N).fill(0);

  for (let i = 0; i < N; i++) {
    let x = adj[i];
    let count = 0;

    while (x > 0n) {
      x &= (x - 1n);
      count++;
    }

    deg[i] = count;
  }

  return deg;
}

const degrees = computeDegrees(adj, N);

// =========================
// Bitset
// =========================
function hasVertex(H, v) {
  return ((H >> BigInt(v)) & 1n) === 1n;
}

function addVertex(H, v) {
  return H | (1n << BigInt(v));
}

function removeVertex(H, v) {
  return H & ~(1n << BigInt(v));
}

// =========================
// Fitness
// =========================
function fitness(H) {
  let count = 0;
  let x = H;

  while (x > 0n) {
    x &= (x - 1n);
    count++;
  }

  return count;
}

// =========================
// Auxiliar
// =========================
function pickRandomBit(bits) {
  const indices = [];

  let i = 0;
  while (bits > 0n) {
    if (bits & 1n) indices.push(i);
    bits >>= 1n;
    i++;
  }

  const r = Math.floor(Math.random() * indices.length);
  return indices[r];
}

// =========================
// Construção de solução
// =========================
function randomClique(adj, N) {
  let v = Math.floor(Math.random() * N);
  let H = addVertex(0n, v);

  let candidates = adj[v];

  while (candidates !== 0n) {
    let u = pickRandomBit(candidates);
    H = addVertex(H, u);
    candidates &= adj[u];
  }

  return H;
}

function extend(H, adj, N) {
  let candidates = ~0n;

  let temp = H;
  let i = 0;

  while (temp > 0n) {
    if (temp & 1n) {
      candidates &= adj[i];
    }
    temp >>= 1n;
    i++;
  }

  candidates &= ~H;

  while (candidates !== 0n) {
    const list = [];
    let temp2 = candidates;
    let j = 0;

    while (temp2 > 0n) {
      if (temp2 & 1n) list.push(j);
      temp2 >>= 1n;
      j++;
    }

    list.sort((a, b) => degrees[b] - degrees[a]);

    let v = list[0];

    H = addVertex(H, v);
    candidates &= adj[v];
  }

  return H;
}

function repair(H, adj, N) {
  for (let i = 0; i < N; i++) {
    if (!hasVertex(H, i)) continue;
    H &= (adj[i] | (1n << BigInt(i)));
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
  let H = 0n;

  for (let i = 0; i < N; i++) {
    if (Math.random() < HMCR) {
      let r = Math.floor(Math.random() * HM.length);
      if (hasVertex(HM[r], i)) {
        H = addVertex(H, i);
      }
    } else {
      if (Math.random() < P) {
        H = addVertex(H, i);
      }
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
      if (!hasVertex(H, i)) continue;

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
// Execução + teste
// =========================
const HMS = 10;
const HMCR = 0.9;
const P = 0.3;
const MAX_ITERS = 1000;

for (let i = 0; i < 5; i++) {
  const best = harmonySearch(adj, N, HMS, HMCR, P, MAX_ITERS);
  console.log("Run", i, "Clique:", fitness(best));
}