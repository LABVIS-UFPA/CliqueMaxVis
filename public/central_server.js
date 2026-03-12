const WebSocket = require('ws');
const zlib = require('zlib');
const path = require('path');

const CENTRAL_HOST = '10.16.1.145';
const CENTRAL_PORT = 41235;
const server = new WebSocket.Server({ port: CENTRAL_PORT });

// Armazena os melhores resultados da rede, separados por nome do dataset
const networkBests = {};
// Armazena os clientes conectados
const clients = new Set();

console.log(`Servidor Central rodando em ws://${CENTRAL_HOST}:${CENTRAL_PORT}`);

const express = require('express');
const app = express();
const httpPort = 3001; // Porta diferente para não conflitar com o outro servidor

app.use(express.static(path.join(__dirname, '')));
app.listen(httpPort, () => {
    console.log(`Servidor de Ranking rodando em http://localhost:${httpPort}`);
});

require('node:child_process')
    .exec(`start http://${CENTRAL_HOST}:${httpPort}/ranking.html`);


server.on('connection', ws => {
    clients.add(ws);
    console.log(`Cliente conectado. Total de clientes: ${clients.size}`);

    ws.on('message', message => {
        try {
            const data = JSON.parse(message.toString());

            switch (data.type) {
                case 'report_best':
                    handleNewBest(data.payload, ws); // Passa a referência do cliente remetente
                    break;
                case 'sync_request':
                    handleSyncRequest(data.payload, ws);
                    break;
                case 'get_ranking_data':
                    handleRankingRequest(ws);
                    break;
                default:
                    console.log('Tipo de mensagem desconhecido:', data.type);
            }
        } catch (e) {
            console.error("Erro ao processar mensagem do cliente:", e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Cliente desconectado. Total de clientes: ${clients.size}`);
    });

    ws.on('error', (error) => {
        console.error('Erro no WebSocket do cliente:', error);
        clients.delete(ws);
    });
});

function handleSyncRequest(clientBests, senderWs) {
    console.log(`Recebido pedido de sincronização de ${clientBests.length} dataset(s).`);

    clientBests.forEach(clientBest => {
        const { datasetName, bestFitness, individuals } = clientBest;

        const networkBest = networkBests[datasetName];

        // Caso 1: O cliente tem uma solução melhor ou o servidor não tem nenhuma.
        if (!networkBest || bestFitness > networkBest.bestFitness) {
            console.log(`Sync: Cliente tem um recorde para '${datasetName}'. Atualizando e transmitindo.`);
            individuals.forEach(individual => handleNewBest({ datasetName, bestFitness, individual, user: individual.user }, senderWs));
        } 
        // Caso 2: O servidor central tem uma solução melhor.
        else if (networkBest.bestFitness > bestFitness) {
            console.log(`Sync: Servidor tem um recorde para '${datasetName}'. Enviando para o cliente.`);
            // Itera sobre todas as melhores soluções e envia cada uma para o cliente.
            networkBest.individuals.forEach(individual => {
                const payload = {
                    datasetName: datasetName,
                    bestFitness: networkBest.bestFitness,
                    user: individual.user,
                    individual: individual
                };                
                // O nodeMask já está comprimido, apenas cria uma cópia segura para enviar.
                const individualToSend = JSON.parse(JSON.stringify(payload.individual));
                payload.individual = individualToSend;
                senderWs.send(JSON.stringify({ type: 'new_network_solution', payload }));
            });
        }
        // Caso 3: Fitness igual, verificar se há novos indivíduos.
        else if (networkBest.bestFitness === bestFitness) {
            console.log(`Sync: Fitness igual para '${datasetName}'. Verificando novos indivíduos.`);
            individuals.forEach(individual => {
                // handleNewBest já contém a lógica para verificar se o indivíduo é novo
                handleNewBest({ datasetName, bestFitness, individual, user: individual.user }, senderWs);
            });
        }
    });
}

function handleRankingRequest(ws) {
    console.log("Recebido pedido de dados para o ranking.");
    // Marca esta conexão como sendo de um cliente de ranking
    ws.isRankingClient = true;
    ws.send(JSON.stringify({
        type: 'ranking_data',
        payload: getRankingSummary()
    }));
}

/**
 * Cria uma versão resumida do objeto networkBests, contendo apenas as informações
 * necessárias para a página de ranking (fitness e usuários), omitindo os dados
 * pesados como o nodeMask.
 * @returns {object} Um objeto de ranking simplificado.
 */
function getRankingSummary() {
    const summary = {};
    for (const datasetName in networkBests) {
        if (Object.hasOwnProperty.call(networkBests, datasetName)) {
            const best = networkBests[datasetName];
            summary[datasetName] = {
                bestFitness: best.bestFitness,
                achievedBy: best.achievedBy,
                // Mapeia os indivíduos para remover apenas o nodeMask, mantendo outras informações.
                individuals: best.individuals.map(ind => {
                    const { nodeMask, ...individualForRanking } = ind; // "ind" é o indivíduo original
                    return individualForRanking; // Retorna o indivíduo sem o nodeMask
                })
            };
        }
    }
    return summary;
}

function broadcastToRankings(data) {
    const message = JSON.stringify(data);
    console.log("Transmitindo atualização para as páginas de ranking...");
    clients.forEach(client => {
        // Envia a mensagem apenas se o cliente for uma página de ranking
        if (client.isRankingClient && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

function handleNewBest(payload, senderWs) { // Recebe o cliente remetente como parâmetro
    const { datasetName, bestFitness, individual, user } = payload;

    // A partir de agora, esperamos que individual.nodeMask seja sempre uma string base64 comprimida.
    // Não vamos mais descomprimir aqui, a menos que seja estritamente necessário para alguma lógica.

    console.log(`Recebido novo 'best' para o dataset '${datasetName}' do usuário '${user}' com fitness ${bestFitness}`);

    // Se não houver registro para este dataset ou se o novo fitness for maior
    if (!networkBests[datasetName] || bestFitness > networkBests[datasetName].bestFitness) {
        console.log(`NOVO RECORDE DA REDE para '${datasetName}'! Fitness: ${bestFitness}. Usuário: ${user}`);
        networkBests[datasetName] = {
            bestFitness,
            // Armazenamos o indivíduo com o nodeMask já comprimido
            individuals: [individual], 
            achievedBy: [user]
        };

        // O payload já está pronto para ser transmitido, pois o nodeMask está comprimido.
        const broadcastPayload = JSON.parse(JSON.stringify(payload));

        // Notifica todos os clientes, exceto o remetente
        broadcast({ // Envia a solução completa para todos
            type: 'new_network_solution',
            payload: broadcastPayload
        }, senderWs);

        // Notifica as páginas de ranking com os dados atualizados
        broadcastToRankings({
            type: 'ranking_data',
            payload: getRankingSummary()
        });
    } else if (bestFitness === networkBests[datasetName].bestFitness) {
        // Se o fitness for igual, verifica se a solução (pela sua string comprimida) já existe
        const exists = networkBests[datasetName].individuals.some(existingInd =>
            existingInd.nodeMask === individual.nodeMask
        );

        if (!exists) {
            console.log(`Novo indivíduo com o mesmo fitness máximo para '${datasetName}'. Adicionando.`);
            networkBests[datasetName].individuals.push(individual);
            if (!networkBests[datasetName].achievedBy.includes(user)) {
                networkBests[datasetName].achievedBy.push(user);
            }

            // O payload já está pronto para ser transmitido.
            const broadcastPayload = JSON.parse(JSON.stringify(payload));

            // Notifica todos os clientes, exceto o remetente
            broadcast({
                type: 'new_network_solution',
                payload: broadcastPayload
            }, senderWs);

            // Notifica as páginas de ranking com os dados atualizados
            broadcastToRankings({
                type: 'ranking_data',
                payload: getRankingSummary()
            });
        }
    }
}

function broadcast(data, senderWs) { // Recebe o remetente para excluí-lo
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
