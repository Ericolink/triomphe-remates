const router = require('express').Router();
const { getDashboard, getPropertyAnalytics } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Métricas y estadísticas del sistema
 */

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Dashboard con métricas generales
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Métricas del sistema }
 */
router.get('/dashboard', authenticate, authorize('admin', 'editor'), getDashboard);

/**
 * @swagger
 * /api/analytics/properties/{id}:
 *   get:
 *     summary: Analytics de una propiedad específica
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Analytics de la propiedad }
 */
router.get('/properties/:id', authenticate, authorize('admin', 'editor'), getPropertyAnalytics);

module.exports = router;
