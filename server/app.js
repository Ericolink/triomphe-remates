const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require('dotenv').config();

const app = express();

// CORS primero — así las respuestas de rate limit también llevan los headers correctos
// CLIENT_URLS acepta múltiples orígenes separados por coma
const allowedOrigins = [
  ...(process.env.CLIENT_URLS ? process.env.CLIENT_URLS.split(',').map((u) => u.trim()) : []),
  process.env.CLIENT_URL,
  'https://triomphedemo.netlify.app',
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

module.exports = app;
