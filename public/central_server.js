const WebSocket = require('ws');

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
                    handleNewBest(data.payload);
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

function handleNewBest(payload) {
    const { datasetName, bestFitness, individual, user } = payload;

    console.log(`Recebido novo 'best' para o dataset '${datasetName}' do usuário '${user}' com fitness ${bestFitness}`);

    // Se não houver registro para este dataset ou se o novo fitness for maior
    if (!networkBests[datasetName] || bestFitness > networkBests[datasetName].bestFitness) {
        console.log(`NOVO RECORDE DA REDE para '${datasetName}'! Fitness: ${bestFitness}. Usuário: ${user}`);
        networkBests[datasetName] = {
            bestFitness,
            individuals: [individual],
            achievedBy: [user]
        };

        // Notifica todos os clientes sobre o novo recorde da rede
        broadcast({
            type: 'new_network_best',
            payload: {
                datasetName,
                bestFitness,
                user
            }
        });
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
        }
    }
}

function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
