const router = require('express').Router();
const { createFeedback, getFeedbacks, updateFeedback, deleteFeedback, batchUpdateFeedback, batchDeleteFeedback } = require('../controllers/feedbackController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, authLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/',          authLimiter, createFeedback);
router.get('/',           apiLimiter, authenticate, authorize('admin', 'editor'), getFeedbacks);
router.patch('/batch',    apiLimiter, authenticate, authorize('admin', 'editor'), batchUpdateFeedback);
router.delete('/batch',   apiLimiter, authenticate, authorize('admin'), batchDeleteFeedback);
router.put('/:id',        apiLimiter, authenticate, authorize('admin', 'editor'), updateFeedback);
router.delete('/:id',     apiLimiter, authenticate, authorize('admin'), deleteFeedback);

module.exports = router;
