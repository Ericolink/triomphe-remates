// Fuente única de verdad para los orígenes permitidos por CORS. Usado tanto por el
// middleware `cors()` en app.js como por el stream SSE en leadController.js — antes cada
// uno mantenía su propia whitelist (app.js leía CLIENT_URLS, el SSE solo CLIENT_URL), lo
// que dejaba el stream de notificaciones roto en silencio si en producción solo se
// configuraba CLIENT_URLS.
//
// CLIENT_URLS acepta múltiples orígenes separados por coma; CLIENT_URL se conserva como
// fallback/compatibilidad para instalaciones existentes que solo definen un dominio.
const allowedOrigins = [
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(',').map((u) => u.trim()) : []),
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

// Vite incrementa el puerto (5174, 5175...) si 5173 ya está ocupado (ej. otra instancia
// de `npm run dev` corriendo en paralelo) — fijar un solo puerto en la whitelist es frágil
// en desarrollo. Solo aplica fuera de producción; en producción la whitelist explícita
// (CLIENT_URL/CLIENT_URLS) sigue siendo la única fuente de verdad.
const isDevLocalOrigin = (origin) =>
  process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

const isOriginAllowed = (origin) =>
  !!origin && (allowedOrigins.includes(origin) || isDevLocalOrigin(origin));

module.exports = { allowedOrigins, isDevLocalOrigin, isOriginAllowed };
