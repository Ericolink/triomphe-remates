// Detección de bots conocidos por User-Agent — heurística deliberadamente simple (ver
// AUDITORIA/análisis de analítica): cubre crawlers de buscadores, previsualizadores de
// redes sociales, herramientas de SEO y clientes HTTP sin interfaz que representan la
// gran mayoría del tráfico automatizado real contra un sitio de este tamaño. No intenta
// ser un WAF — eventos marcados isBot=true se guardan (no se descartan) para poder
// auditar cuánto tráfico se está filtrando, ver analyticsService.recordEvent.
const BOT_UA_PATTERN =
  /bot|spider|crawl|slurp|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|facebookexternalhit|facebookcatalog|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|applebot|curl|wget|python-requests|python-urllib|node-fetch|go-http-client|postmanruntime|headlesschrome|phantomjs|puppeteer|playwright/i;

const isBotUserAgent = (ua) => !ua || BOT_UA_PATTERN.test(ua);

module.exports = { isBotUserAgent };
