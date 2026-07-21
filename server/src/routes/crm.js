const router = require('express').Router();
const { getCrmDashboard, getCrmReports } = require('../controllers/crmAnalyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: CRM
 *   description: Dashboard y reportes comerciales agregados (CRM Comercial)
 */

router.get('/dashboard', apiLimiter, authenticate, authorize('admin', 'editor'), getCrmDashboard);
router.get('/reports', apiLimiter, authenticate, authorize('admin', 'editor'), getCrmReports);

module.exports = router;
