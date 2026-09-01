const { URL } = require('url');

// Reduce una URL de referrer a solo su host ("www.google.com" -> "google.com"), nunca la
// URL completa — evita persistir query strings de terceros que puedan traer tokens/IDs de
// sesión ajenos. Devuelve null ante cualquier entrada vacía o no parseable como URL.
function extractReferrerHost(referrer) {
  if (!referrer || typeof referrer !== 'string') return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

module.exports = { extractReferrerHost };
