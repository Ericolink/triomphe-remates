const router = require('express').Router();
const {
  getInventoryDownloadSetting,
  updateInventoryDownloadSetting,
} = require('../controllers/settingsController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

// Solo admin — mismo patrón exacto que /api/audit (routes/audit.js). El toggle controla
// si el público puede descargar el inventario, no una preferencia de negocio que un
// coordinador/asesor deba poder tocar.
router.get('/inventory-download', apiLimiter, authenticate, authorize('admin'), getInventoryDownloadSetting);
router.put('/inventory-download', apiLimiter, authenticate, authorize('admin'), updateInventoryDownloadSetting);

module.exports = router;
