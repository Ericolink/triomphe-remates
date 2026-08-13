const router = require('express').Router();
const {
  exportExcel,
  exportPDF,
  exportFeedbackExcel,
  exportLeadsExcel,
  exportPropertyQuotePDF,
} = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { exportLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Exportación de inventario
 */

// Exportación de inventario: Coordinador de ventas solo tiene este permiso (ver
// exportarpropiedades) además de Admin y Asistente administrativo — Asesor de ventas
// solo puede ver el inventario, no exportarlo.
router.get(
  '/excel',
  exportLimiter,
  authenticate,
  authorize('admin', 'coordinador_ventas', 'asistente_administrativo'),
  exportExcel
);
router.get(
  '/pdf',
  exportLimiter,
  authenticate,
  authorize('admin', 'coordinador_ventas', 'asistente_administrativo'),
  exportPDF
);
router.get(
  '/feedback/excel',
  exportLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  exportFeedbackExcel
);
router.get('/leads/excel', exportLimiter, authenticate, requireCrmAccess, exportLeadsExcel);
router.get('/property/:id/pdf', exportLimiter, exportPropertyQuotePDF);

module.exports = router;
