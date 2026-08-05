const router = require('express').Router();
const { getDeals, getDealById } = require('../controllers/dealController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Deals
 *   description: Ventas cerradas (CRM Comercial) — solo se crean vía PUT /leads/:id/close-won
 */

router.get('/', apiLimiter, authenticate, requireCrmAccess, getDeals);
router.get('/:id', apiLimiter, authenticate, requireCrmAccess, getDealById);

module.exports = router;
