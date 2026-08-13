const router = require('express').Router();
const {
  getProperties,
  getPropertyById,
  getPropertyBySlug,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadImages,
  deleteImage,
  setCoverImage,
  reorderImages,
  getPromotedProperty,
  promoteProperty,
  getStatusHistory,
  getPublicPriceHistory,
  trackView,
  trackShare,
  getPropertyStats,
  getPropertiesSync,
} = require('../controllers/propertyController');
const { authenticate, attachUserIfPresent } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Gestión de propiedades
 */

router.get('/', apiLimiter, attachUserIfPresent, getProperties);
router.get('/stats', apiLimiter, getPropertyStats);
router.get('/promoted', apiLimiter, getPromotedProperty);
router.get('/sync', apiLimiter, getPropertiesSync);
router.get('/slug/:slug', apiLimiter, attachUserIfPresent, getPropertyBySlug);
router.get('/:id', apiLimiter, attachUserIfPresent, getPropertyById);

router.post('/', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), createProperty);
router.put('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), updateProperty);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteProperty);

router.put('/:id/promote', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), promoteProperty);
router.get(
  '/:id/status-history',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  getStatusHistory
);
router.get('/:id/price-history', apiLimiter, getPublicPriceHistory);
router.post('/:id/view', apiLimiter, trackView);
router.post('/:id/share', apiLimiter, trackShare);
router.post(
  '/:id/images',
  uploadLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  upload.array('images', 20),
  uploadImages
);
router.delete(
  '/:id/images/:imageId',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  deleteImage
);
router.put(
  '/:id/images/:imageId/cover',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  setCoverImage
);
router.put(
  '/:id/images/reorder',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  reorderImages
);

module.exports = router;
