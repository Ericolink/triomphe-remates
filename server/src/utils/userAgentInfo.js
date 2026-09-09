// Clasificador mínimo de User-Agent a device/browser "humanos" para la lista de sesiones
// activas (ver sessionService.js). No es un parser completo (no cubre versión, engine, bot
// detection, etc. — para eso ya existe botDetection.js con otro propósito) y a propósito no
// agrega una dependencia (ua-parser-js y similares): solo necesitamos las categorías que
// pide la UI de "Sesiones activas", y una regex acotada es más barata de mantener que una
// librería genérica para ese alcance.
//
// El orden de los checks importa: un UA de Edge también matchea "Chrome/", uno de Chrome
// también matchea "Safari/", y uno de Android también matchea "Linux" — cada rama más
// específica debe evaluarse antes que la genérica que la contendría.
const parseUserAgent = (userAgent) => {
  if (!userAgent || typeof userAgent !== 'string') return { device: null, browser: null };

  const ua = userAgent;

  let device = null;
  if (/iphone/i.test(ua)) device = 'iPhone';
  else if (/ipad/i.test(ua)) device = 'iPad';
  else if (/android/i.test(ua)) device = 'Android';
  else if (/windows/i.test(ua)) device = 'Windows';
  else if (/mac os x|macintosh/i.test(ua)) device = 'macOS';
  else if (/linux/i.test(ua)) device = 'Linux';

  let browser = null;
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  return { device, browser };
};

module.exports = { parseUserAgent };
