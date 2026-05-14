
const control = {
    cooldown: 0,
    lastDiagnosis: null,
    repeatCount: 0,
    noRealGain: 0,
    bestEver: -Infinity,
    frozen: false
};

function autoAdjust(metrics, diagnosis, history, params) {

    const dict = {};

    if (!metrics || !diagnosis || !params) {
        return dict;
    }

    if (control.frozen) {
    if (
        diagnosis.state === "collapsed" ||
        diagnosis.state === "chaotic"
    ) {
        control.frozen = false;
    } else {
        return {};
    }
    }


    // -------------------------
    // progresso global
    // -------------------------
    if (metrics.bestFitness > control.bestEver) {
        control.bestEver = metrics.bestFitness;
        control.noRealGain = 0;
    } else {
        control.noRealGain++;
    }

    // -------------------------
    // cooldown
    // -------------------------
    if (control.cooldown > 0) {
        control.cooldown--;
        return dict;
    }

    // -------------------------
    // repetição diagnóstico
    // -------------------------
    if (control.lastDiagnosis === diagnosis.state) {
        control.repeatCount++;
    } else {
        control.repeatCount = 1;
        control.lastDiagnosis = diagnosis.state;
    }

    // const size = metrics.size;

    // const best = metrics.bestFitness;
    // const avg = metrics.averageFitness;
    // const diversity = metrics.diversity;
    // const repeated = metrics.repeatedCount;
    // const unique = metrics.uniqueCount;

    if (
        control.noRealGain >= 200 &&
        (diagnosis.state === "healthy" || diagnosis.state === "neutral")
    ) {
        control.frozen = true;

        console.log("AUTOAJUSTE CONGELADO");
        return {};
    }

    // COLLAPSED
    if (diagnosis.state === "collapsed") {
        dict.mutationRate =
            clamp(params.mutationRate + 0.10, 0.01, 0.35);

        dict.mutationSelectionRate =
            clamp(params.mutationSelectionRate + 0.15, 0.01, 0.60);

        dict.survivalRate =
            clamp(params.survivalRate - 0.10, 0.10, 0.60);

        dict.populationSize =
            clampInt(params.populationSize + 20, 30, 200);

        // dict.mutationType = "bitFlip";
            
        control.cooldown = 20;

        return dict;
    }

    // CONVERGING
    if (diagnosis.state === "converging") {

        dict.mutationRate =
            clamp(params.mutationRate + 0.03, 0.01, 0.35);

        dict.survivalRate =
            clamp(params.survivalRate - 0.05, 0.10, 0.60);

        control.cooldown = 10;
        return dict;
    }

    // CHAOTIC
    if (diagnosis.state === "chaotic") {
        dict.mutationRate =
            clamp(params.mutationRate - 0.03, 0.01, 0.35);

        dict.survivalRate =
            clamp(params.survivalRate + 0.05, 0.10, 0.60);
            
        control.cooldown = 10;

        return dict;
    }

    // LOCAL OPTIMUM
    if (diagnosis.state === "local_optimum") {

        // primeira tentativa
        if (control.repeatCount <= 2) {
            dict.populationSize =
                clampInt(params.populationSize + 20, 30, 200);
        }

        // segunda tentativa
        else if (control.repeatCount <= 4) {
            dict.mutationSelectionRate =
                clamp(params.mutationSelectionRate + 0.08, 0.01, 0.60);
        }

        // terceira tentativa
        else if (control.repeatCount <= 6) {
            dict.mutationRate =
                clamp(params.mutationRate + 0.04, 0.01, 0.35);
        }

        // quarta tentativa
        else {
            dict.survivalRate =
                clamp(params.survivalRate - 0.05, 0.10, 0.60);
        }

        control.cooldown = 15;
        return dict;
    }

    // HEALTHY
    if (diagnosis.state === "healthy") {
        return dict;
    }

    // fallback
    return dict;
}

// HELPERS

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function clampInt(v, min, max) {
    return Math.round(clamp(v, min, max));
}

if (typeof module !== "undefined") {
    module.exports = { autoAdjust };
}