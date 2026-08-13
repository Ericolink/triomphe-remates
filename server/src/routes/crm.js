const router = require('express').Router();
const { getCrmDashboard, getCrmReports } = require('../controllers/crmAnalyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: CRM
 *   description: Dashboard y reportes comerciales agregados (CRM Comercial)
 */

// Antes gateado por role (admin/editor), inconsistente con el resto del módulo CRM que
// usa requireCrmAccess — corregido de paso: ahora un Coordinador de ventas (sin CRM)
// tampoco puede pegarle a estos endpoints, igual que ya no ve el link en el sidebar.
router.get('/dashboard', apiLimiter, authenticate, requireCrmAccess, getCrmDashboard);
router.get('/reports', apiLimiter, authenticate, requireCrmAccess, getCrmReports);

module.exports = router;
