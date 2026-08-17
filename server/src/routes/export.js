const router = require('express').Router();
const {
  exportExcel,
  exportPDF,
  exportFeedbackExcel,
  exportLeadsExcel,
  exportPropertyQuotePDF,
  exportWaitingListExcel,
  exportWaitingListPDF,
  exportCatalogExcel,
  exportCatalogPDF,
} = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { exportLimiter, publicFormLimiter } = require('../middleware/rateLimitMiddleware');

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
router.get(
  '/waiting-list/excel',
  exportLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  exportWaitingListExcel
);
router.get(
  '/waiting-list/pdf',
  exportLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  exportWaitingListPDF
);

// Catálogo público (sitio principal, sin auth) — gateado por datos de contacto: cada
// descarga primero registra un Lead (ver exportCatalogExcel/PDF) antes de generar el
// archivo. POST (no GET) porque manda datos de contacto en el body.
router.post('/catalog/excel', exportLimiter, publicFormLimiter, exportCatalogExcel);
router.post('/catalog/pdf', exportLimiter, publicFormLimiter, exportCatalogPDF);

module.exports = router;
