function getPopulationMetrics(population) {

    if (!population || population.length === 0) {
        return {
            size: 0,
            bestFitness: 0,
            worstFitness: 0,
            averageFitness: 0,
            repeatedCount: 0,
            uniqueCount: 0,
            diversity: 0
        };
    }

    const size = population.length;

    // console.log(population);

    let bestFitness = -Infinity;
    let worstFitness = Infinity;
    let fitnessSum = 0;

    const map = new Map();

    // -------------------------
    // FITNESS + REPETIDOS
    // -------------------------


    for (const ind of population) {
        const fit = ind.fitness;

        
        if (fit > bestFitness) bestFitness = fit; // melhor fitness da geração
        if (fit < worstFitness) worstFitness = fit; // pior fitness da geração
        
        fitnessSum += fit;
        const key = ind.nodeMask.join(""); // string única representando a solução (ex: "11001")
        map.set(key, (map.get(key) || 0) + 1); // conta quantas vezes cada solução aparece, baseado no map criado acima
    }
    const averageFitness = fitnessSum / size; // média de fitness da geração
    let repeatedCount = 0;
    
    for (const count of map.values()) { // conta quantas vezes cada solução aparece
        if (count > 1) {
            repeatedCount += (count - 1);
        }
    }
    const uniqueCount = map.size; // número de soluções únicas (tamanho do map, que tem chaves únicas)
    
    // -------------------------
    // DIVERSIDADE
    // Média de diferenças entre pares
    // -------------------------
    
    let diversity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < size; i++) {
        const a = population[i].nodeMask;
        
        for (let j = i + 1; j < size; j++) {
            const b = population[j].nodeMask;
            let diff = 0;
            for (let k = 0; k < a.length; k++) {
                if (a[k] !== b[k]) diff++;
            }
            diversity += diff / a.length;
            pairCount++;
        }
    }
    diversity = pairCount > 0 ? diversity / pairCount : 0;
    
    // console.log(size,
    //     bestFitness,
    //     worstFitness,
    //     averageFitness,
    //     repeatedCount,
    //     uniqueCount,
    //     diversity);

    return {
        size,
        bestFitness,
        worstFitness,
        averageFitness,
        repeatedCount,
        uniqueCount,
        diversity
    };
}

if (typeof module !== "undefined") {
    module.exports = { getPopulationMetrics };
}