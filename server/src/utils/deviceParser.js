// Parseo de User-Agent deliberadamente simple: cubre los casos reales de tráfico de
// Triomphe (navegadores de escritorio/móvil normales) sin sumar una dependencia pesada
// (ua-parser-js y similares traen bases de datos de miles de reglas para casos que este
// negocio no necesita). Nunca lanza — un UA raro o ausente cae a 'unknown'/null.

// El orden importa: Edge y Opera incluyen "Chrome" en su UA, y Chrome incluye "Safari".
const BROWSER_RULES = [
  ['Edg/', 'Edge'],
  ['OPR/', 'Opera'],
  ['Opera', 'Opera'],
  ['Chrome/', 'Chrome'],
  ['CriOS', 'Chrome'],
  ['Firefox/', 'Firefox'],
  ['FxiOS', 'Firefox'],
  ['Safari/', 'Safari'],
];

const OS_RULES = [
  ['Windows', 'Windows'],
  ['Mac OS X', 'macOS'],
  ['Android', 'Android'],
  ['iPhone', 'iOS'],
  ['iPad', 'iOS'],
  ['CrOS', 'ChromeOS'],
  ['Linux', 'Linux'],
];

function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') {
    return { device: 'unknown', browser: null, os: null };
  }

  let device = 'desktop';
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) {
    device = 'tablet';
  } else if (/Mobi|iPhone|iPod|Android/i.test(ua)) {
    device = 'mobile';
  }

  const browser = BROWSER_RULES.find(([needle]) => ua.includes(needle))?.[1] || null;
  const os = OS_RULES.find(([needle]) => ua.includes(needle))?.[1] || null;

  return { device, browser, os };
}

module.exports = { parseUserAgent };
