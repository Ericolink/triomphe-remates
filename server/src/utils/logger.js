const fs = require('fs');
const path = require('path');
const winston = require('winston');

const isProd = process.env.NODE_ENV === 'production';

// El deploy vive en SmarterASP/IIS (httpPlatformHandler) con filesystem persistente — a
// diferencia de Render, escribir a disco sí sobrevive entre requests. web.config mantiene
// stdoutLogEnabled="false" en producción porque ese log de IIS no rota ni tiene límite de
// tamaño (ver comentario en web.config), así que estos File transports, acotados por tamaño,
// son la fuente de diagnóstico persistente una vez que el proceso ya arrancó.
const transports = [new winston.transports.Console()];

if (isProd) {
  const logsDir = path.join(__dirname, '..', '..', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const rotation = { maxsize: 5 * 1024 * 1024, maxFiles: 5, tailable: true };
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      ...rotation,
    }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log'), ...rotation })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: isProd
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `${timestamp} [${level}] ${message}${metaStr}`;
        })
      ),
  transports,
});

module.exports = logger;
