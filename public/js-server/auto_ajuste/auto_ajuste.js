// const state = {
//   generation: 0,
//   bestEver: -Infinity,
//   noImproveCount: 0,
//   history: [],
//   cooldown: 0
// }


// function Observer(best) {
//     state.generation++

//     if (best > state.bestEver) {
//         state.bestEver = best
//         state.noImproveCount = 0
//     } else {
//         state.noImproveCount++
//     }

//     console.log(state.noImproveCount)

//     if (state.noImproveCount >= 100 && state.cooldown === 0) {
//         state.noImproveCount = 0;
//         return {
//             action: "increase_mutation",
//             value: 0.05
//         }
//     }

//     return { action: null }
// }

// if (typeof module !== "undefined") module.exports = { Observer };


const state = {
    generation: 0,
    bestEver: -Infinity,
    noImproveCount: 0,
    cooldown: 0,
    currentState: false
}

function Observer({
 best,
 avg,
 diversity,
 repeated,
 generation
}) {

    state.generation++

    if (best > state.bestEver) {
        state.bestEver = best
        state.noImproveCount = 0
    } else {
        state.noImproveCount++
    }

    if (state.cooldown > 0) {
        state.cooldown--
    }

    if (state.noImproveCount >= 1000) {
        state.plateau = true;
        console.log("Autoajuste travado: platô atingido.");
        return { action: null };
    }

    console.log(        
        "Gen:", state.generation,
        "BestEver:", state.bestEver,
        "NoImprove:", state.noImproveCount,
        "Cooldown:", state.cooldown)

    if (state.cooldown > 0) {
        return { action: null }
    }

    

    return { action: null }
}

if (typeof module !== "undefined") module.exports = { Observer }