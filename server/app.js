const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { resolveUserKey } = require('./src/middleware/rateLimitMiddleware');
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
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, hsts: false }));

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
  // IIS/httpPlatformHandler envía IP:puerto en X-Forwarded-For — quitar el puerto. El
  // regex viejo (`.replace(/:\d+$/, '')`) también mutilaba direcciones IPv6 crudas (ej.
  // "::1" → ":", colapsando clientes IPv6 distintos a la misma key) — express-rate-limit
  // ahora lo detecta en build/arranque (ERR_ERL_KEY_GEN_IPV6) porque el keyGenerator usa
  // req.ip sin pasar por su helper de normalización. Solo se quita el puerto en los dos
  // formatos reales que puede mandar el proxy (IPv4:puerto o [IPv6]:puerto); cualquier
  // otra cosa se deja intacta y siempre se normaliza con ipKeyGenerator.
  keyGenerator: (req) => {
    const userKey = resolveUserKey(req);
    if (userKey) return userKey;
    const raw = req.ip || req.socket.remoteAddress || '';
    const bracketedIpv6 = raw.match(/^\[(.+)\]:\d+$/);
    const ipv4WithPort = raw.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/);
    const ip = bracketedIpv6?.[1] || ipv4WithPort?.[1] || raw;
    return ipKeyGenerator(ip);
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Triomphe API corriendo' });
});

// Servir el frontend compilado
const clientBuildPath = path.join(__dirname, 'client');
app.use(express.static(clientBuildPath));
app.get('*path', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Middleware de error centralizado — debe ir al final. Todos los controllers usan
// ApiError como mecanismo estándar de errores de dominio.
app.use(require('./src/middleware/errorHandler').errorHandler);

module.exports = app;
