
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

    // se as metricas estiverem vazias, retorna um dicionario nulo
    if (!metrics || !diagnosis || !params) {
        return dict;
    }

    // cancela o envio de dados a função de loop caso a variavel frozen seja nulo
    if (control.frozen) {
        // caso state seja collapsed ou chaotic por algum motivo, frozen se torna falso e o auto ajuste volta a avaliar o a entrada
        if (
            diagnosis.state === "collapsed" ||
            diagnosis.state === "chaotic"
        ) {
            control.frozen = false; 
        } else {
            return {};
        }
    }


    // se o melhor fitness das metricas for melhor que o melhor fitness armazenado na função interna, variavel que mede as gerações sem ganho é zerado e o melhor fitness é atualizado
    if (metrics.bestFitness > control.bestEver) {
        control.bestEver = metrics.bestFitness;
        control.noRealGain = 0;
    } else {
        control.noRealGain++;
    }

    // permite que o ag possa realizar mutações atraves da mudança dos pparametros antes de causar novas mudanças
    if (control.cooldown > 0) {
        control.cooldown--;
        return dict;
    }

    // realiza a contagem de gerações em que o estado do diagnostico não é alterado
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

    // se o não existir ganho real e o estado o diagnostico for healthy ou neutral em mais de 200 gerações, o sistema faz com que o codigo pare de atualizar devido a ter chegado em uma solução
    if (
        control.noRealGain >= 200 &&
        (diagnosis.state === "healthy" || diagnosis.state === "neutral")
    ) {
        control.frozen = true;

        console.log("AUTOAJUSTE CONGELADO");
        return {};
    }

    /**
     * com a população quase ou toda igual, a diversidade fica próxima de zero e os meelhores estagnam
     * Em termos biológicos: a população perdeu variabilidade genética. realiza exploração forçada
     */
    if (diagnosis.state === "collapsed") {
        //Mais mutação é equivalente a mais genes mudando. Quebra clones e gerar soluções diferentes.
        dict.mutationRate = clamp(params.mutationRate + 0.10, 0.01, 0.35);

        // Mais bits/genes afetados durante mutação, reraliznado alterações em mais posições de cada indivíduo
        dict.mutationSelectionRate = clamp(params.mutationSelectionRate + 0.15, 0.01, 0.60);

        // a cada geração mantem menos sobreviventes fixos da geração anterior, realizando a diminução do elitismo e abre espaço para novos indivíduo
        dict.survivalRate = clamp(params.survivalRate - 0.10, 0.10, 0.60);

        // Maior quanridade de indivíduos é equivalente a mais tentativas paralelas, aumentando espaço de busca
        dict.populationSize = clampInt(params.populationSize + 20, 30, 200);
            
        // com a mudança significativa, o sistema espera por 20 gerações para seja possivel entender o resultado
        control.cooldown = 20;

        return dict;
    }

    /**
     * AG está caminhando para uma solução rapido demais, fazendo com qua diversidade diminua cedo demais, prestes a colapsar
     * tenta evitar um possivel colapso
     */
    if (diagnosis.state === "converging") {

        //Pequeno aumento de diversidade.
        dict.mutationRate = clamp(params.mutationRate + 0.03, 0.01, 0.35);

        // Menos pressão elitista.
        dict.survivalRate = clamp(params.survivalRate - 0.05, 0.10, 0.60);

        // com a mudança significativa, o sistema espera por 10 gerações para seja possivel entender o resultado
        control.cooldown = 10;
        return dict;
    }

    /**
     * diversidade alta demais, fazando a media ser imprecisa e melhores indicidos serem instaveis. é muito aleatório
     * 
    */
   
    if (diagnosis.state === "chaotic") {
        // Reduz bagunça genética.
        dict.mutationRate = clamp(params.mutationRate - 0.03, 0.01, 0.35);

        // Mais sobrevivência dos bons indivíduos.
        dict.survivalRate = clamp(params.survivalRate + 0.05, 0.10, 0.60);
            
        // cooldown = 20 - com a mudança significativa, o sistema espera por 20 gerações para seja possivel entender o resultado
        control.cooldown = 10;

        return dict;
    }

    // LOCAL OPTIMUM
    if (diagnosis.state === "local_optimum") {
        
        if (control.repeatCount <= 2) {
            dict.populationSize = clampInt(params.populationSize + 20, 30, 200);
        }
        else if (control.repeatCount <= 4) {
            dict.mutationSelectionRate = clamp(params.mutationSelectionRate + 0.08, 0.01, 0.60);
        }
        else if (control.repeatCount <= 6) {
            dict.mutationRate = clamp(params.mutationRate + 0.04, 0.01, 0.35);
        }
        else if (control.repeatCount <= 8) {
            dict.survivalRate = clamp(params.survivalRate - 0.05, 0.10, 0.60);
        }
        else {
            control.frozen = true;
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