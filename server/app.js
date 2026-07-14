const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const app = express();

// AUDIT-003: IIS/httpPlatformHandler (SmarterASP.NET) actúa como proxy inverso — sin esto,
// req.ip resuelve siempre a la IP interna del proxy, lo que inutiliza el rate limiting por IP
// y falsea los logs de auditoría.
app.set('trust proxy', 1);

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
// CLIENT_URLS acepta múltiples orígenes separados por coma
const allowedOrigins = [
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(',').map((u) => u.trim()) : []),
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 2000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' },
  // IIS/httpPlatformHandler envía IP:puerto en X-Forwarded-For — strip the port.
  keyGenerator: (req) => (req.ip || req.socket.remoteAddress || '').replace(/:\d+$/, ''),
});
app.use(limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
app.use('/api/audit',      require('./src/routes/audit'));
app.use('/api/testimonials', require('./src/routes/testimonials'));

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

// AUDIT-014: middleware de error centralizado — debe ir al final. Disponible para
// controllers nuevos vía next(error)/ApiError; los controllers existentes no se tocaron.
app.use(require('./src/middleware/errorHandler').errorHandler);

module.exports = app;
