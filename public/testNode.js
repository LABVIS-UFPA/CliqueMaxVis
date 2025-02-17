


const fs = require("fs");
const {Graph, CliqueBuilder, CliqueSolver} = require("./graph.js");

// let dbpath = "../exemplosGrafos/grafoK5.txt";
// let dbpath = "../exemplosGrafos/homer.col.txt";
// let dbpath = "../exemplosGrafos/queen5_5.col.txt";
let dbpath = "../exemplosGrafos/clique34.txt";
// let dbpath = "../exemplosGrafos/clique34.txt";


let txt = fs.readFileSync(dbpath, {encoding:"utf-8"});

let graph = new Graph();
graph.importFromText(txt);

for(let i=0;i<graph.nodes.length;i++){
    for(let j=i+1;j<graph.nodes.length;j++){
        let r = graph.hasSameAdjs(graph.nodes[i],graph.nodes[j]);
        if(r<90){
            console.log(r, `nodes[${graph.nodes[i].id},${graph.nodes[j].id}]`);
        }
    }
}




// let CS = new CliqueSolver(graph);
// CS.setObserver({
//     log: (text)=>{
//         process.stdout.write(text+"                   ");
//         process.stdout.cursorTo(0);
//         // process.stdout.write("\n");
//     },
//     end: ()=>{
//         process.stdout.cursorTo(20);
//         process.stdout.write("\n");
//     }
// });

// let result = CS.alg10();
// console.log(result);
// let valid = true;
// for(let r of result){
//     let clique = new CliqueBuilder(graph,{nodes:r});
//     if(!clique.isValid()) {
//         valid = false;
//         break;
//     }
// }
// console.log("Todos Válidos: ", valid);
// console.log("Quantidade de cliques: ", result.length);
// console.log("Tamanho do clique máximo: ", result[0].length);




// // let startTime = performance.now();
// let result;
// let saveFunc = (partialSolution)=>{
    
//     partialSolution.resp = partialSolution.resp.map(cb=>cb.toModel());
//     partialSolution.isSorted = true; // Comentar quando não for para ordenar o grafo.
//     fs.writeFileSync(dbpath+".parcial.json", JSON.stringify(partialSolution), {encoding:"utf-8"});
// };
// // chama salvando os resultados parciais.
// if(fs.existsSync(dbpath+".parcial.json")){
//     let partial = JSON.parse(fs.readFileSync(dbpath+".parcial.json", {encoding:"utf-8"}));
//     partial.resp = partial.resp.map(cbModel => CliqueBuilder.fromModel(cbModel,undefined));
//     console.log("...Continuando!");


//     if(partial.isSorted){
//         partial.div = graph.sortLinksByCliquesReverse();
//     }
//     result = CS.alg7_3(saveFunc,partial);
// }else{
//     let div = graph.sortLinksByCliquesReverse(); // Comentar quando não for para ordenar o grafo.
//     result = CS.alg7_3(saveFunc, {cursor:Infinity,div,resp:[]});
// }

// // result = CS.alg7_2(); //chama sem salvar resultados parciais.


// let max = Math.max(...result.map(c=>c.clique.length));
// let counts = [0]
// for (let i = 2; i <= max; i++) {
// counts.push(result.reduce((acc, cur) => cur.clique.length===i?acc+1:acc, 0));
// }
// // console.log(result);
// console.log("counts: ", counts);
// console.log("MAX: ",max);
// // console.log((performance.now() - startTime)/1000);


