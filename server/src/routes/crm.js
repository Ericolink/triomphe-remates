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

// SEC-001/SEC-002: estos dos endpoints agregan datos SIN aplicar getLeadVisibilityWhere
// por fila (PII de citas/actividad reciente de prospectos ajenos, ingresos/desempeño de
// toda la empresa, desglose "por asesor") — no es viable filtrar cada sub-consulta sin
// distorsionar el significado de métricas inherentemente globales (ventas de la semana,
// mejor campaña, funnel completo). En vez de eso se restringe la ruta a los mismos roles
// que ya tienen `hasBackofficeAccess` en el frontend (client/src/utils/permissions.js):
// `asesor_ventas`/`coordinador_ventas` ni siquiera pueden navegar a /admin/dashboard (la
// ruta está protegida ahí con `RoleRoute allow={hasBackofficeAccess}`), así que este
// cambio no revoca ningún acceso que la UI les ofreciera — solo cierra el acceso directo
// a la API que la UI nunca exponía. `requireCrmAccess` (que sí admite asesor_ventas) queda
// deliberadamente sin usar aquí.
router.get(
  '/dashboard',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  getCrmDashboard
);
router.get(
  '/reports',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  getCrmReports
);

module.exports = router;
