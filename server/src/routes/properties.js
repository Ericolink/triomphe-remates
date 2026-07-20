const router = require('express').Router();
const {
  getProperties, getPropertyById, getPropertyBySlug,
  createProperty, updateProperty, deleteProperty,
  uploadImages, deleteImage, setCoverImage, reorderImages,
  getPromotedProperty, promoteProperty, getStatusHistory, getPublicPriceHistory, trackShare, getPropertyStats,
  getPropertiesSync,
} = require('../controllers/propertyController');
const { getDocuments, getAllDocuments, uploadDocument, deleteDocument, setDocumentVisibility } = require('../controllers/documentController');
const { authenticate, attachUserIfPresent } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { uploadDoc } = require('../middleware/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Gestión de propiedades
 */

router.get('/', apiLimiter, getProperties);
router.get('/stats', apiLimiter, getPropertyStats);
router.get('/promoted', apiLimiter, getPromotedProperty);
router.get('/sync', apiLimiter, getPropertiesSync);
router.get('/slug/:slug', apiLimiter, getPropertyBySlug);
router.get('/:id', apiLimiter, attachUserIfPresent, getPropertyById);

router.post('/', apiLimiter, authenticate, authorize('admin', 'editor'), createProperty);
router.put('/:id', apiLimiter, authenticate, authorize('admin', 'editor'), updateProperty);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteProperty);

router.put('/:id/promote', apiLimiter, authenticate, authorize('admin', 'editor'), promoteProperty);
router.get('/:id/status-history', apiLimiter, authenticate, authorize('admin', 'editor'), getStatusHistory);
router.get('/:id/price-history', apiLimiter, getPublicPriceHistory);
router.post('/:id/share', apiLimiter, trackShare);
router.post('/:id/images', uploadLimiter, authenticate, authorize('admin', 'editor'), upload.array('images', 20), uploadImages);
router.delete('/:id/images/:imageId', apiLimiter, authenticate, authorize('admin', 'editor'), deleteImage);
router.put('/:id/images/:imageId/cover', apiLimiter, authenticate, authorize('admin', 'editor'), setCoverImage);
router.put('/:id/images/reorder', apiLimiter, authenticate, authorize('admin', 'editor'), reorderImages);

router.get('/:id/documents', apiLimiter, getDocuments);
router.get('/:id/documents/all', apiLimiter, authenticate, authorize('admin', 'editor'), getAllDocuments);
router.post('/:id/documents', uploadLimiter, authenticate, authorize('admin', 'editor'), uploadDoc.single('file'), uploadDocument);
router.patch('/:id/documents/:docId/visibility', apiLimiter, authenticate, authorize('admin', 'editor'), setDocumentVisibility);
router.delete('/:id/documents/:docId', apiLimiter, authenticate, authorize('admin', 'editor'), deleteDocument);

module.exports = router;
