const fs = require('fs');

// =========================
// 1. Leitura DIMACS (ESSENCIAL)
// =========================
function readDimacs(path) {
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n');

  let N = 0;
  let M = 0;
  const edges = [];

  for (let line of lines) {
    line = line.trim();

    if (line.length === 0) continue;
    if (line.startsWith('c')) continue;

    if (line.startsWith('p')) {
      const parts = line.split(/\s+/);
      N = parseInt(parts[2]);
      M = parseInt(parts[3]);
    }

    if (line.startsWith('e')) {
      const parts = line.split(/\s+/);
      const u = parseInt(parts[1]) - 1; // 0-index
      const v = parseInt(parts[2]) - 1;
      edges.push([u, v]);
    }
  }

  return { N, M, edges };
}

const { N, M, edges } = readDimacs('C:\\Users\\Akaz Marinho\\Documents\\Discover\\Mestrado\\Pesquisa\\CliqueMaxVis\\exemplosGrafos\\brock200_2.clq.txt');

// DEBUG (pode ativar se precisar validar leitura)
// console.log('Vertices:', N);
// console.log('Arestas:', M);
// console.log('Primeiras arestas:', edges.slice(0, 5));


// =========================
// 2. Estrutura do grafo (ESSENCIAL)
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
// (ÚTIL PARA DEBUG — MANTER)
// =========================
function getNeighbors(adj, v, N) {
  const neighbors = [];
  let bits = adj[v];

  for (let i = 0; i < N; i++) {
    if ((bits >> BigInt(i)) & 1n) {
      neighbors.push(i);
    }
  }

  return neighbors;
}

// DEBUG (verificar vizinhos)
// console.log(getNeighbors(adj, 2, N));


// =========================
// 3. Operações com bitset (ESSENCIAL)
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

function intersect(A, B) {
  return A & B;
}

// (ÚTEIS MAIS TARDE — manter)
function union(A, B) {
  return A | B;
}

function difference(A, B) {
  return A & ~B;
}


// =========================
// DEBUG LOCAL (não essencial agora)
// =========================

// let H = 0n;
// H = addVertex(H, 2);
// H = addVertex(H, 5);
// console.log(hasVertex(H, 2)); // true
// console.log(hasVertex(H, 3)); // false
// H = removeVertex(H, 2);
// console.log(hasVertex(H, 2)); // false


// =========================
// TESTE CONCEITUAL (removível depois)
// =========================

// let candidates = adj[2];
// let clique = addVertex(0n, 2);
// let comuns = intersect(candidates, adj[5]);
// console.log(clique, comuns);

function isClique(H, adj, N) {
  for (let i = 0; i < N; i++) {
    if (!hasVertex(H, i)) continue;

    // pega todos os vértices do clique exceto i
    let others = H & ~(1n << BigInt(i));

    // todos precisam ser vizinhos de i
    if ((adj[i] & others) !== others) {
      return false;
    }
  }

  return true;
}

// let H = 0n;

// H = addVertex(H, 2);
// H = addVertex(H, 0);

// console.log(isClique(H, adj, N)); // depende do grafo

// H = addVertex(H, 50);

// console.log(isClique(H, adj, N)); // provavelmente false

function fitness(H) {
  let count = 0;

  while (H > 0n) {
    H &= (H - 1n); // remove o bit menos significativo ligado
    count++;
  }

  return count;
}

// let H = 0n;

// H = addVertex(H, 2);
// H = addVertex(H, 5);
// H = addVertex(H, 10);

// console.log(fitness(H)); // 3

function randomClique(adj, N) {
  // escolhe vértice inicial
  let v = Math.floor(Math.random() * N);
  let H = addVertex(0n, v);

  // candidatos: vizinhos de v
  let candidates = adj[v];

  while (candidates !== 0n) {
    // escolher um vértice aleatório dentro de candidates
    let u = pickRandomBit(candidates);

    // adiciona ao clique
    H = addVertex(H, u);

    // mantém apenas vértices conectados a TODOS do clique
    candidates = candidates & adj[u];
  }

  return H;
}

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

// let H = randomClique(adj, N);

// console.log(fitness(H));        // tamanho
// console.log(isClique(H, adj, N)); // deve ser true

function extend(H, adj, N) {
  // candidatos: vértices que podem entrar no clique
  let candidates = null;

  // constrói interseção dos vizinhos de todos os vértices do clique
  for (let i = 0; i < N; i++) {
    if (!hasVertex(H, i)) continue;

    if (candidates === null) {
      candidates = adj[i];
    } else {
      candidates &= adj[i];
    }
  }

  // remove vértices já presentes
  candidates &= ~H;

  // adiciona enquanto houver candidatos válidos
  while (candidates !== 0n) {
    let v = pickRandomBit(candidates);

    H = addVertex(H, v);

    // atualiza candidatos: precisa continuar sendo clique
    candidates &= adj[v];
  }

  return H;
}

// let H = randomClique(adj, N);

// console.log(fitness(H)); // antes

// H = extend(H, adj, N);

// console.log(fitness(H)); // depois (>= antes)
// console.log(isClique(H, adj, N)); // sempre true

// for (let i = 0; i < 10; i++) {
//   let H = randomClique(adj, N);
//   let before = fitness(H);

//   H = extend(H, adj, N);
//   let after = fitness(H);

//   console.log(before, after);
// }

function repair(H, adj, N) {
  for (let i = 0; i < N; i++) {
    if (!hasVertex(H, i)) continue;

    // mantém apenas vértices conectados a i (incluindo ele mesmo)
    H &= (adj[i] | (1n << BigInt(i)));
  }

  return H;
}

// let H = 0n;

// // adiciona vértices aleatórios (provavelmente inválido)
// for (let i = 0; i < 10; i++) {
//   let v = Math.floor(Math.random() * N);
//   H = addVertex(H, v);
// }

// console.log(isClique(H, adj, N)); // provavelmente false

// H = repair(H, adj, N);

// console.log(isClique(H, adj, N)); // deve ser true
// console.log(fitness(H)); // tamanho do clique gerado

function generateSolution(adj, N) {
  // 1. gerar solução aleatória (pode ser inválida)
  let H = 0n;

  for (let i = 0; i < N; i++) {
    if (Math.random() < 0.5) {
      H = addVertex(H, i);
    }
  }

  // 2. corrigir (garantir clique)
  H = repair(H, adj, N);

  // 3. expandir (tornar maior possível)
  H = extend(H, adj, N);

  return H;
}

// let H = generateSolution(adj, N);

// console.log(isClique(H, adj, N)); // sempre true
// console.log(fitness(H));          // tamanho > 0

// inicio do HS

function initializeHM(HMS, adj, N) {
  const HM = [];

  for (let i = 0; i < HMS; i++) {
    let H = randomClique(adj, N); // já gera clique válido
    H = extend(H, adj, N);        // garante que está bem expandido

    HM.push(H);
  }

  return HM;
}

const HMS = 10; // tamanho da memória

let HM = initializeHM(HMS, adj, N);

// // conferir se todos são cliques válidos
// for (let i = 0; i < HM.length; i++) {
//   console.log(i, isClique(HM[i], adj, N), fitness(HM[i]));
// }

function newHarmony(HM, HMCR, P, N) {
  let H = 0n;

  for (let i = 0; i < N; i++) {
    if (Math.random() < HMCR) {
      // pega valor de alguma solução da memória
      let r = Math.floor(Math.random() * HM.length);

      if (hasVertex(HM[r], i)) {
        H = addVertex(H, i);
      }
    } else {
      // gera aleatório
      if (Math.random() < P) {
        H = addVertex(H, i);
      }
    }
  }

  return H;
}

const HMCR = 0.9; // usa memória na maioria das vezes
const P = 0.3;    // chance de colocar 1 aleatoriamente

// let H = newHarmony(HM, HMCR, P, N);

// for (let i = 0; i < 5; i++) {
//   let H = newHarmony(HM, HMCR, P, N);
//   console.log(fitness(H)); // valores variados
// }

function generateValidHarmony(HM, HMCR, P, adj, N) {
  // 1. gera solução (pode ser inválida)
  let H = newHarmony(HM, HMCR, P, N);

  // 2. corrige
  H = repair(H, adj, N);

  // 3. melhora
  H = extend(H, adj, N);

  return H;
}

// let H = generateValidHarmony(HM, HMCR, P, adj, N);

// for (let i = 0; i < 5; i++) {
//   let H = generateValidHarmony(HM, HMCR, P, adj, N);

//   console.log(
//     isClique(H, adj, N), // deve ser true
//     fitness(H)
//   );
// }

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

let H_new = generateValidHarmony(HM, HMCR, P, adj, N);

updateHM(HM, H_new);

// for (let i = 0; i < 20; i++) {
//   let H_new = generateValidHarmony(HM, HMCR, P, adj, N);
//   updateHM(HM, H_new);
// }

// console.log(HM.map(h => fitness(h)));


function harmonySearch(adj, N, HMS, HMCR, P, MAX_ITERS) {
  // inicializa memória
  let HM = initializeHM(HMS, adj, N);

  // melhor solução global
  let best = HM[0];

  for (let i = 1; i < HM.length; i++) {
    if (fitness(HM[i]) > fitness(best)) {
      best = HM[i];
    }
  }

  // loop principal
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    // gera nova solução válida
    let H_new = generateValidHarmony(HM, HMCR, P, adj, N);

    // atualiza memória
    updateHM(HM, H_new);

    // atualiza melhor global
    if (fitness(H_new) > fitness(best)) {
      best = H_new;
    }
  }

  return best;
}

// const HMS = 10;
// const HMCR = 0.9;
// const P = 0.3;
const MAX_ITERS = 1000;

let best = harmonySearch(adj, N, HMS, HMCR, P, MAX_ITERS);


function localSearch(H, adj, N) {
  let improved = true;

  while (improved) {
    improved = false;

    // tenta remover 1 vértice por vez
    for (let i = 0; i < N; i++) {
      if (!hasVertex(H, i)) continue;

      // remove i
      let H2 = removeVertex(H, i);

      // tenta expandir novamente
      H2 = extend(H2, adj, N);

      // se melhorou, aceita
      if (fitness(H2) > fitness(H)) {
        H = H2;
        improved = true;
        break; // reinicia busca
      }
    }
  }

  return H;
}

// let H_new = generateValidHarmony(HM, HMCR, P, adj, N);

// aplica busca local
H_new = localSearch(H_new, adj, N);

updateHM(HM, H_new);

// let H = randomClique(adj, N);
// H = extend(H, adj, N);

// let before = fitness(H);

// H = localSearch(H, adj, N);

// let after = fitness(H);

// console.log(before, after);