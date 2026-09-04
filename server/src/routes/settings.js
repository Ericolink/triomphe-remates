const router = require('express').Router();
const {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
  getPublicPropertiesSetting,
  updatePublicPropertiesSetting,
} = require('../controllers/settingsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

// Público, sin auth — el CTA de CatalogDownloadForm.jsx necesita saber de antemano si el
// PDF se va a entregar o no, para no ofrecer "Descargar PDF del inventario" cuando el
// toggle admin está desactivado. El valor (true/false) no es información sensible: ya se
// revela indirectamente al enviar el formulario (PDF vs. JSON), así que exponer su lectura
// sin auth no abre superficie nueva — la escritura sigue exclusivamente admin-only abajo.
// Reutiliza el mismo handler que la ruta admin (no lee req.user, solo el flag), nada más
// cambia el middleware de acceso.
router.get('/inventory-download/status', apiLimiter, getInventoryDownloadSetting);

// Solo admin — mismo patrón exacto que /api/audit (routes/audit.js). El toggle controla
// si el público puede descargar el inventario, no una preferencia de negocio que un
// coordinador/asesor deba poder tocar.
router.get('/inventory-download', apiLimiter, authenticate, authorize('admin'), getInventoryDownloadSetting);
router.put('/inventory-download', apiLimiter, authenticate, authorize('admin'), updateInventoryDownloadSetting);

// Solo admin — controla si el inventario se muestra en la sección pública de propiedades
// (listado/detalle/búsqueda/sitemap). No confundir con /inventory-download: ese gatea la
// entrega del PDF del catálogo, este gatea la visibilidad de las propiedades en sí. Ambos
// flags son independientes a propósito (ver propertyController.js y routes/sitemap.js).
router.get('/public-properties', apiLimiter, authenticate, authorize('admin'), getPublicPropertiesSetting);
router.put('/public-properties', apiLimiter, authenticate, authorize('admin'), updatePublicPropertiesSetting);

module.exports = router;
