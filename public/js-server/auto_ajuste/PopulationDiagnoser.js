// ===============================
// HISTORY + DIAGNOSIS SYSTEM
// ===============================

const state = {
    history: {
        best: [],
        avg: [],
        diversity: [],
        repeated: [],
        unique: []
    },
    maxHistory: 30
};

// Mantém um histórico dos últimos 30 valores de cada métrica para análise de tendências
function updateHistory(metrics) {
    // console.log(state);

    pushLimit(state.history.best, metrics.bestFitness);
    pushLimit(state.history.avg, metrics.averageFitness);
    pushLimit(state.history.diversity, metrics.diversity);
    pushLimit(state.history.repeated, metrics.repeatedCount);
    pushLimit(state.history.unique, metrics.uniqueCount);

}

// mantém somente últimas 30 posições
function pushLimit(arr, value) {

    arr.push(value);

    if (arr.length > state.maxHistory) {
        arr.shift();
    }
}

// ======================================
// 2. DIAGNOSE
// ======================================

function diagnose(metrics) {

    const h = state.history;

    const bestTrendFlat = isFlat(h.best, 10, 0.01);
    const avgTrendFlat = isFlat(h.avg, 10, 0.30);

    const bestImproving = isImproving(h.best, 10, 1);
    const avgImproving = isImproving(h.avg, 10, 0.50);

    const diversityLow = metrics.diversity < 0.05;
    const diversityHigh = metrics.diversity > 0.55;

    const repeatedHigh =
        metrics.repeatedCount >= metrics.size * 0.60;

    const avgNearBest =
        metrics.bestFitness - metrics.averageFitness <= 1;

    // -------------------------
    // COLLAPSED
    // -------------------------
    if (
        diversityLow &&
        repeatedHigh &&
        avgNearBest &&
        bestTrendFlat
    ) {
        return {
            state: "collapsed",
            action: "critical_escape"
        };
    }

    // -------------------------
    // CONVERGING TOO MUCH
    // -------------------------
    if (
        diversityLow &&
        avgNearBest &&
        !bestImproving
    ) {
        return {
            state: "converging",
            action: "increase_mutation"
        };
    }

    // -------------------------
    // CHAOTIC
    // -------------------------
    if (
        diversityHigh &&
        metrics.averageFitness <
        metrics.bestFitness * 0.60
    ) {
        return {
            state: "chaotic",
            action: "reduce_mutation"
        };
    }

    // -------------------------
    // STAGNATED LOCAL OPTIMUM
    // -------------------------
    if (
        bestTrendFlat &&
        !bestImproving &&
        metrics.diversity > 0.03 &&
        metrics.diversity < 0.40
    ) {
        return {
            state: "local_optimum",
            action: "increase_population"
        };
    }

    // -------------------------
    // HEALTHY
    // -------------------------
    if (bestImproving || avgImproving) {
        return {
            state: "healthy",
            action: null
        };
    }

    return {
        state: "neutral",
        action: null
    };
}

// ======================================
// HELPERS
// ======================================

// verifica se últimos 30 valores ficaram iguais
function isFlat(arr, n, tolerance = 0.20) {

    if (arr.length < n) return false;

    const start = arr.length - n;

    let min = arr[start];
    let max = arr[start];

    for (let i = start + 1; i < arr.length; i++) {
        if (arr[i] < min) min = arr[i];
        if (arr[i] > max) max = arr[i];
    }

    return (max - min) <= tolerance;
}

function isImproving(arr, n, gain = 1) {

    if (arr.length < n) return false;

    const oldValue = arr[arr.length - n];
    const newValue = arr[arr.length - 1];

    return (newValue - oldValue) >= gain;
}
// ======================================
// EXPORT
// ======================================

if (typeof module !== "undefined") {
    module.exports = {
        updateHistory,
        diagnose,
        state
    };
}