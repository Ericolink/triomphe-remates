const router = require('express').Router();
const { getDashboard, getPropertyAnalytics } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: Métricas y estadísticas del sistema
 */

router.get('/dashboard', apiLimiter, authenticate, authorize('admin', 'editor'), getDashboard);
router.get(
  '/properties/:id',
  apiLimiter,
  authenticate,
  authorize('admin', 'editor'),
  getPropertyAnalytics
);

module.exports = router;
