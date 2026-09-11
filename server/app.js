const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { resolveUserKey, resolveClientIp } = require('./src/middleware/rateLimitMiddleware');
const { isBotUserAgent } = require('./src/utils/botDetection');
const {
  renderPropertyOgHtml,
  renderStaticPageOgHtml,
  isPublicPropertySlug,
} = require('./src/utils/propertyOgMeta');
const logger = require('./src/utils/logger');
require('dotenv').config();

const app = express();

// AUDIT-003: IIS/httpPlatformHandler (SmarterASP.NET) actúa como proxy inverso — sin esto,
// req.ip resuelve siempre a la IP interna del proxy, lo que inutiliza el rate limiting por IP
// y falsea los logs de auditoría.
app.set('trust proxy', 1);

// Primer middleware, antes que cualquier otra cosa — así absolutamente toda respuesta
// (incluyendo un rechazo de CORS o de rate limiting, que nunca llegan a un controller)
// lleva un id de correlación. Ver requestContext.js / errorHandler.js.
app.use(require('./src/middleware/requestContext'));

// La redirección HTTP → HTTPS se hace a nivel IIS (panel de SmarterASP → Advanced
// Features → Force HTTPS), no aquí — ocurre antes de que la petición llegue a Node.

// Cabeceras de seguridad HTTP (helmet). El servidor sirve dos tipos de página muy distintos
// bajo el mismo Express: la SPA de React (CSP estricta) y la documentación de Swagger en
// /api/docs (necesita scripts/estilos inline para inicializar su propio bundle — sin esto
// la página de docs queda en blanco). Por eso se aplican dos políticas CSP según la ruta.
//
// crossOriginEmbedderPolicy se deja explícitamente desactivado: todas las imágenes de
// propiedades se sirven desde Cloudinary (res.cloudinary.com), que NO envía la cabecera
// Cross-Origin-Resource-Policy (verificado contra su CDN). Si se activara COEP, todas las
// fotos del sitio dejarían de cargar.
//
// crossOriginResourcePolicy se relaja a 'cross-origin' por el mismo motivo: el default de
// helmet ('same-origin') hace que Firefox bloquee las respuestas de la API cuando el
// frontend de Vite en dev (http://localhost:5173) las consulta desde otro origen
// (http://localhost:3001) — un origen que CORS (más abajo, isOriginAllowed) ya autoriza
// explícitamente. En producción API y frontend son same-origin (mismo Express sirve
// ambos), así que esto no relaja nada ahí; solo evita que CORP contradiga a CORS en dev.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: false,
  })
);

const publicCsp = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
  },
});

// Swagger UI (swagger-ui-express) inyecta un <script> y <style> inline para arrancar su
// bundle — no soporta nonces. Se acepta 'unsafe-inline' solo en esta ruta de documentación
// (no es contenido producido por usuarios, es generado por la librería) en vez de relajar
// la política para todo el sitio.
const docsCsp = helmet.contentSecurityPolicy({
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
  },
});

app.use((req, res, next) => (req.path.startsWith('/api/docs') ? docsCsp(req, res, next) : publicCsp(req, res, next)));

// CORS primero — así las respuestas de rate limit también llevan los headers correctos
// La whitelist de orígenes vive en utils/corsOrigins.js — es la misma fuente de verdad
// que usa el stream SSE de leadController.js, para que ambos no puedan desincronizarse.
const { isOriginAllowed, CorsError } = require('./src/utils/corsOrigins');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new CorsError());
    }
  },
  credentials: true,
  // Retry-After no está en la lista de headers "simples" que el navegador expone por
  // default a fetch/axios en una respuesta cross-origin — sin esto, el frontend en dev
  // (Vite en :5173 llamando a la API en :3001) no puede leer el valor para el countdown
  // visual de "demasiados intentos" (ver LoginPage.jsx). En producción es same-origin y no
  // hace falta, pero declararlo aquí no tiene costo.
  exposedHeaders: ['Retry-After'],
}));

// Rate limiting global — solo sobre /api. Antes cubría también los estáticos del build
// de React y el fallback de index.html (abajo): App.jsx usa React.lazy() en casi cada
// página, así que cada navegación del SPA descarga un chunk JS más, y cada uno contaba
// contra este mismo cupo compartido por IP. Con varias personas probando desde la misma
// red de oficina (misma IP/NAT), el cupo se agotaba con navegación normal — no era un
// ataque. Los estáticos no necesitan este limiter: no ejecutan lógica de negocio ni tocan
// la base de datos, así que no son un vector de DoS costoso como sí lo son las rutas /api.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 2000 : 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
  // Este limiter corre antes que authenticate en cualquier ruta, así que aquí no hay
  // req.user todavía — resolveUserKey decodifica el JWT (si viene uno válido) para que
  // el tráfico logueado tenga su propio cupo por usuario en vez de compartirlo con quien
  // sea que esté en la misma IP/NAT (ver rateLimitMiddleware.js). Solo el tráfico anónimo
  // cae a IP.
  //
  // IIS/httpPlatformHandler envía IP:puerto en X-Forwarded-For — resolveClientIp (ver
  // rateLimitMiddleware.js) le quita el puerto antes de pasarlo a ipKeyGenerator; el mismo
  // helper lo usan los limiters de login para construir sus keys, así ambos normalizan la
  // IP exactamente igual.
  keyGenerator: (req) => {
    const userKey = resolveUserKey(req);
    if (userKey) return userKey;
    return ipKeyGenerator(resolveClientIp(req));
  },
});
app.use(['/api', '/sitemap.xml'], limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger docs — solo fuera de producción, para no exponer el mapa de rutas/schemas públicamente
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Rutas
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/properties', require('./src/routes/properties'));
app.use('/api/leads',      require('./src/routes/leads'));
app.use('/sitemap.xml',    require('./src/routes/sitemap'));
app.use('/api/jobs',       require('./src/routes/jobs'));
app.use('/api/export',     require('./src/routes/export'));
app.use('/api/analytics',  require('./src/routes/analytics'));
app.use('/api/users',      require('./src/routes/users'));
app.use('/api/feedback',   require('./src/routes/feedback'));
app.use('/api/alerts',     require('./src/routes/alerts'));
app.use('/api/waiting-list', require('./src/routes/waitingList'));
app.use('/api/audit',      require('./src/routes/audit'));
app.use('/api/testimonials', require('./src/routes/testimonials'));
app.use('/api/campaigns',    require('./src/routes/campaigns'));
app.use('/api/appointments', require('./src/routes/appointments'));
app.use('/api/deals',        require('./src/routes/deals'));
app.use('/api/crm',          require('./src/routes/crm'));
app.use('/api/settings',     require('./src/routes/settings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Triomphe API corriendo' });
});

// Servir el frontend compilado
const clientBuildPath = path.join(__dirname, 'client');
const indexHtmlPath = path.join(clientBuildPath, 'index.html');

// Rutas públicas reales de la SPA (ver <Route> públicas en client/src/App.jsx) — duplicadas
// aquí a propósito, mismo motivo que CITY_LABELS en propertyOgMeta.js: este archivo no puede
// importar App.jsx (bundle de Vite). Se usan abajo para distinguir una URL pública real de una
// inexistente/typo y devolver 404 en vez del "soft 404" (200 con el shell de la SPA) que tenía
// el catch-all anterior — Search Console clasifica esto último como error de indexación.
const KNOWN_PUBLIC_PATHS = new Set([
  '/',
  '/propiedades',
  '/contacto',
  '/nosotros',
  '/proceso-adquisicion',
  '/trabaja-con-nosotros',
  '/buzon',
  '/favoritos',
  '/comparar',
  '/cancelar-alerta',
  '/mi-alerta',
  '/preguntas-frecuentes',
  '/aviso-de-privacidad',
]);
// Cualquier ruta que empiece así es el panel admin (SPA propia autenticada, ver App.jsx) —
// siempre debe recibir el shell con 200 sin importar el sufijo, aunque no aparezca en
// KNOWN_PUBLIC_PATHS: es una app cliente completa con sus propias sub-rutas dinámicas
// (/admin/propiedades/:id/editar, etc.) y ya está fuera del índice vía robots.txt.
const isAdminPath = (p) => p === '/admin' || p.startsWith('/admin/');
// Una petición a algo con extensión (.jpg, .js, .css, .xml, .ico...) que express.static no
// encontró es un asset roto, no una ruta de la SPA — ninguna ruta real de App.jsx lleva punto.
const looksLikeStaticAsset = (p) => /\.[a-zA-Z0-9]+$/.test(p);

// Crawlers de redes sociales y buscadores (facebookexternalhit, WhatsApp, LinkedInBot,
// Googlebot... ver botDetection.js) no ejecutan JS en su primera pasada: reciben siempre este
// index.html tal cual, así que nunca ven el <Helmet> dinámico de SEO.jsx. Home y /propiedades
// son las páginas que más necesitan competir por "remates bancarios" (ver AUDITORIA_SEO), así
// que reciben el mismo tratamiento puntual que ya existía solo para fichas de propiedad — no
// es una migración a SSR, es un render de metadata para crawlers; usuarios reales (UA normal)
// siguen recibiendo el index.html genérico y la SPA de siempre.
app.get(['/', '/propiedades'], (req, res, next) => {
  if (!isBotUserAgent(req.headers['user-agent'])) return next();
  const pageKey = req.path === '/' ? 'home' : 'propiedades';
  try {
    const html = renderStaticPageOgHtml(pageKey, clientBuildPath);
    if (!html) return next();
    res.send(html);
  } catch (error) {
    logger.error('Error generando metadata OG estática', { path: req.path, error: error.message });
    next();
  }
});

app.get('/propiedades/:slug', async (req, res, next) => {
  try {
    if (isBotUserAgent(req.headers['user-agent'])) {
      const html = await renderPropertyOgHtml(req.params.slug, clientBuildPath);
      if (html) return res.send(html);
      // Slug inexistente/no público para un bot: mismo estatus 404 que un visitante normal
      // (ver rama de abajo), en vez de servir el shell genérico con 200 (soft 404).
      return res.status(404).sendFile(indexHtmlPath);
    }
    // Visitante normal: no se le inyecta metadata (la arma su propio <Helmet> al cargar), pero
    // si el slug no existe o no es público, el estatus HTTP debe reflejarlo — antes esta ruta
    // devolvía 200 sin importar nada, cayendo al catch-all genérico (ver AUDITORIA_SEO punto 1).
    const exists = await isPublicPropertySlug(req.params.slug);
    // Se responde aquí mismo en vez de next(): el catch-all de abajo ya no asume 200 para
    // cualquier ruta (ver AUDITORIA_SEO punto 1) y no reconoce slugs dinámicos como "públicos
    // conocidos" — dejar que cayera ahí devolvería 404 también para una propiedad que sí existe.
    return res.status(exists ? 200 : 404).sendFile(indexHtmlPath);
  } catch (error) {
    logger.error('Error resolviendo /propiedades/:slug', {
      slug: req.params.slug,
      error: error.message,
    });
    next();
  }
});

app.use(express.static(clientBuildPath));

// Todo lo que llega aquí no fue resuelto por ninguna ruta de arriba ni por un archivo estático
// real. Antes esto devolvía siempre 200 con el shell de la SPA sin importar la URL — cualquier
// typo, asset borrado o link viejo se indexaba como si fuera contenido válido ("soft 404", ver
// AUDITORIA_SEO punto 1). Ahora: un asset con extensión que no se encontró es un 404 real: y
// una ruta desconocida (no está en KNOWN_PUBLIC_PATHS ni es del panel admin) sigue sirviendo el
// shell para que el router de React pueda renderizar su propia página "no encontrada" (ver
// App.jsx), pero con el código de estado 404 correcto en vez de 200.
app.get('*path', (req, res) => {
  if (looksLikeStaticAsset(req.path)) return res.status(404).end();
  const status = isAdminPath(req.path) || KNOWN_PUBLIC_PATHS.has(req.path) ? 200 : 404;
  res.status(status).sendFile(indexHtmlPath);
});

// Middleware de error centralizado — debe ir al final. Todos los controllers usan
// ApiError como mecanismo estándar de errores de dominio.
app.use(require('./src/middleware/errorHandler').errorHandler);

module.exports = app;
