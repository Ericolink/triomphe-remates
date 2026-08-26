const router = require('express').Router();
const {
  getPublicTestimonials,
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} = require('../controllers/testimonialController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

const testimonialImages = upload.fields([
  { name: 'beforeImage', maxCount: 1 },
  { name: 'afterImage', maxCount: 1 },
]);

router.get('/public', apiLimiter, getPublicTestimonials);

router.get(
  '/admin/all',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  getAllTestimonials
);
router.get('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), getTestimonialById);
router.post(
  '/',
  uploadLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  testimonialImages,
  createTestimonial
);
router.put(
  '/:id',
  uploadLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  testimonialImages,
  updateTestimonial
);
router.delete('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), deleteTestimonial);

module.exports = router;
