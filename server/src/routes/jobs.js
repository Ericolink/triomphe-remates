const router = require('express').Router();
const {
  getPositions, getAllPositions, getPositionById,
  createPosition, updatePosition, deletePosition,
  applyToPosition, getApplications, updateApplication, deleteApplication,
} = require('../controllers/jobController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, publicFormLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Bolsa de trabajo
 */

// Rutas públicas
router.get('/', apiLimiter, getPositions);
router.get('/applications', apiLimiter, authenticate, authorize('admin', 'editor'), getApplications);
router.get('/admin/all', apiLimiter, authenticate, authorize('admin', 'editor'), getAllPositions);
router.get('/:id', apiLimiter, getPositionById);
router.post('/:id/apply', publicFormLimiter, applyToPosition);

// Rutas admin
router.post('/', apiLimiter, authenticate, authorize('admin', 'editor'), createPosition);
router.put('/:id', apiLimiter, authenticate, authorize('admin', 'editor'), updatePosition);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deletePosition);
router.put('/applications/:id', apiLimiter, authenticate, authorize('admin', 'editor'), updateApplication);
router.delete('/applications/:id', apiLimiter, authenticate, authorize('admin'), deleteApplication);

module.exports = router;
