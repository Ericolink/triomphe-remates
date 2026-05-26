const router = require('express').Router();
const { exportExcel, exportPDF } = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { exportLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Exportación de inventario
 */

router.get('/excel', exportLimiter, authenticate, authorize('admin', 'editor'), exportExcel);
router.get('/pdf', exportLimiter, authenticate, authorize('admin', 'editor'), exportPDF);

module.exports = router;
