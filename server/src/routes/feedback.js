const router = require('express').Router();
const {
  createFeedback,
  getFeedbacks,
  updateFeedback,
  deleteFeedback,
  batchUpdateFeedback,
  batchDeleteFeedback,
} = require('../controllers/feedbackController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, publicFormLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/', publicFormLimiter, createFeedback);
router.get('/', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), getFeedbacks);
router.patch('/batch', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), batchUpdateFeedback);
router.delete('/batch', apiLimiter, authenticate, authorize('admin'), batchDeleteFeedback);
router.put('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), updateFeedback);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteFeedback);

module.exports = router;
