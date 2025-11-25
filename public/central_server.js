const WebSocket = require('ws');
const zlib = require('zlib');

const CENTRAL_HOST = '10.16.1.145';
const CENTRAL_PORT = 41235;
const server = new WebSocket.Server({ host: CENTRAL_HOST, port: CENTRAL_PORT });

// Armazena os melhores resultados da rede, separados por nome do dataset
const networkBests = {};
// Armazena os clientes conectados
const clients = new Set();

console.log(`Servidor Central rodando em ws://${CENTRAL_HOST}:${CENTRAL_PORT}`);

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

        // Descomprime os nodeMasks recebidos do cliente
        individuals.forEach(individual => {
            const decompressed = zlib.gunzipSync(Buffer.from(individual.nodeMask, 'base64')).toString();
            individual.nodeMask = decompressed.split('').map(bit => parseInt(bit));
        });

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
                // Comprime o nodeMask antes de enviar
                const individualToSend = JSON.parse(JSON.stringify(individual));
                individualToSend.nodeMask = zlib.gzipSync(individualToSend.nodeMask.join('')).toString('base64');
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


function handleNewBest(payload, senderWs) { // Recebe o cliente remetente como parâmetro
    const { datasetName, bestFitness, individual, user } = payload;
    
    // Descomprime o nodeMask se ele vier comprimido (string base64)
    if (typeof individual.nodeMask === 'string') {
        const decompressed = zlib.gunzipSync(Buffer.from(individual.nodeMask, 'base64')).toString();
        individual.nodeMask = decompressed.split('').map(bit => parseInt(bit));
    }
    console.log(`Recebido novo 'best' para o dataset '${datasetName}' do usuário '${user}' com fitness ${bestFitness}`);

    // Se não houver registro para este dataset ou se o novo fitness for maior
    if (!networkBests[datasetName] || bestFitness > networkBests[datasetName].bestFitness) {
        console.log(`NOVO RECORDE DA REDE para '${datasetName}'! Fitness: ${bestFitness}. Usuário: ${user}`);
        networkBests[datasetName] = {
            bestFitness,
            individuals: [individual],
            achievedBy: [user]
        };

        // Prepara o payload para transmissão (comprimindo o nodeMask)
        const broadcastPayload = JSON.parse(JSON.stringify(payload));
        broadcastPayload.individual.nodeMask = zlib.gzipSync(individual.nodeMask.join('')).toString('base64');

        // Notifica todos os clientes, exceto o remetente
        broadcast({ // Envia a solução completa para todos
            type: 'new_network_solution',
            payload: broadcastPayload
        }, senderWs);
    } else if (bestFitness === networkBests[datasetName].bestFitness) {
        // Se o fitness for igual, verifica se a solução já existe
        const exists = networkBests[datasetName].individuals.some(existingInd =>
            JSON.stringify(existingInd.nodeMask) === JSON.stringify(individual.nodeMask)
        );

        if (!exists) {
            console.log(`Novo indivíduo com o mesmo fitness máximo para '${datasetName}'. Adicionando.`);
            networkBests[datasetName].individuals.push(individual);
            if (!networkBests[datasetName].achievedBy.includes(user)) {
                networkBests[datasetName].achievedBy.push(user);
            }

            // Prepara o payload para transmissão (comprimindo o nodeMask)
            const broadcastPayload = JSON.parse(JSON.stringify(payload));
            broadcastPayload.individual.nodeMask = zlib.gzipSync(individual.nodeMask.join('')).toString('base64');

            // Notifica todos os clientes, exceto o remetente
            broadcast({
                type: 'new_network_solution',
                payload: broadcastPayload
            }, senderWs);
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
