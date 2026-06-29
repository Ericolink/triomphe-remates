const winston = require('winston');

// AUDIT-016: el deploy es un único servicio Render con filesystem efímero (ver CLAUDE.md) —
// escribir a server/logs/*.log se perdería en cada redeploy y no aparecería en el dashboard
// de logs de Render, que captura stdout. Por eso el único transport es Console, con JSON
// estructurado en producción (parseable) y formato legible en desarrollo.
const isProd = process.env.NODE_ENV === 'production';

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
  transports: [new winston.transports.Console()],
});

module.exports = logger;
