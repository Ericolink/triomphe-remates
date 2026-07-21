const router = require('express').Router();
const { getDeals, getDealById } = require('../controllers/dealController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Deals
 *   description: Ventas cerradas (CRM Comercial) — solo se crean vía PUT /leads/:id/close-won
 */

router.get('/', apiLimiter, authenticate, authorize('admin', 'editor'), getDeals);
router.get('/:id', apiLimiter, authenticate, authorize('admin', 'editor'), getDealById);

module.exports = router;
