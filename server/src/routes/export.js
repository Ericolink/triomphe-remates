const router = require('express').Router();
const { exportExcel, exportPDF, exportFeedbackExcel, exportLeadsExcel, exportPropertyQuotePDF } = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { exportLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Exportación de inventario
 */

router.get('/excel',          exportLimiter, authenticate, authorize('admin', 'editor'), exportExcel);
router.get('/pdf',            exportLimiter, authenticate, authorize('admin', 'editor'), exportPDF);
router.get('/feedback/excel', exportLimiter, authenticate, authorize('admin', 'editor'), exportFeedbackExcel);
router.get('/leads/excel',    exportLimiter, authenticate, authorize('admin', 'editor'), exportLeadsExcel);
router.get('/property/:id/pdf', exportLimiter, exportPropertyQuotePDF);

module.exports = router;
