

const winston = require('winston');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logFileName) {
        const logDir = path.resolve(__dirname, '..', 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        this.logFilePath = path.join(logDir, logFileName);
        this.fields = ['Timestamp', 'Type', 'Action'];
        
        // Verifica se o arquivo já existe, se não, adiciona o cabeçalho
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, this.fields.join('\t') + '\n', { flag: 'w' });
        }

        this.logger = winston.createLogger({
            transports: [
                new winston.transports.File({
                    filename: this.logFilePath,
                    format: winston.format.printf(({ message }) => message)
                })
            ]
        });
    }

    log(...data) {
        if (data.length !== this.fields.length-1) {
            throw new Error(`Número incorreto de argumentos. Esperado ${this.fields.length-1}, recebido ${data.length}.`);
        }
        this.logger.info(`${new Date().toISOString()}\t${data[0]}\t${data[1]}`);
    }
}

module.exports = Logger;
