const router = require('express').Router();
const {
  getProperties, getPropertyById, getPropertyBySlug,
  createProperty, updateProperty, deleteProperty,
  uploadImages, deleteImage, setCoverImage,
  getPromotedProperty, promoteProperty,
} = require('../controllers/propertyController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Gestión de propiedades
 */

router.get('/', apiLimiter, getProperties);
router.get('/promoted', apiLimiter, getPromotedProperty);
router.get('/slug/:slug', apiLimiter, getPropertyBySlug);
router.get('/:id', apiLimiter, getPropertyById);

router.post('/', apiLimiter, authenticate, authorize('admin', 'editor'), createProperty);
router.put('/:id', apiLimiter, authenticate, authorize('admin', 'editor'), updateProperty);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteProperty);

router.put('/:id/promote', apiLimiter, authenticate, authorize('admin', 'editor'), promoteProperty);
router.post('/:id/images', uploadLimiter, authenticate, authorize('admin', 'editor'), upload.array('images', 20), uploadImages);
router.delete('/:id/images/:imageId', apiLimiter, authenticate, authorize('admin', 'editor'), deleteImage);
router.put('/:id/images/:imageId/cover', apiLimiter, authenticate, authorize('admin', 'editor'), setCoverImage);

module.exports = router;
