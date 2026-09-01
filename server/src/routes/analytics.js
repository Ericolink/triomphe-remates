const express = require('express');
const router = express.Router();
const { getDashboard, getPropertyAnalytics, createEvent, getTrafficDashboard } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, analyticsLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Métricas y estadísticas del sistema
 */

router.get('/dashboard', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), getDashboard);
router.get(
  '/properties/:id',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  getPropertyAnalytics
);
router.get('/traffic', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), getTrafficDashboard);

// POST /events — público y anónimo (nunca lleva JWT). El body llega como text/plain cuando
// lo manda navigator.sendBeacon (evita el preflight CORS que dispararía un Content-Type
// application/json en una petición cross-origin, ver client/src/utils/analytics.js), o ya
// parseado como objeto cuando lo manda el fallback fetch keepalive con
// Content-Type: application/json — ese caso lo consume el express.json() GLOBAL de app.js
// (montado antes de este router), así que aquí solo hace falta cubrir text/plain: si se
// repitiera 'application/json' en este `type`, intentaría leer un body que el parser global
// ya consumió. createEvent normaliza ambos casos (string u objeto ya parseado).
router.post('/events', express.text({ type: 'text/plain', limit: '8kb' }), analyticsLimiter, createEvent);

module.exports = router;
