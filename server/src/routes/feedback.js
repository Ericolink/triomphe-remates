const router = require('express').Router();
const { createFeedback, getFeedbacks, updateFeedback, deleteFeedback } = require('../controllers/feedbackController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, authLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/',    authLimiter, createFeedback);
router.get('/',     apiLimiter, authenticate, authorize('admin', 'editor'), getFeedbacks);
router.put('/:id',  apiLimiter, authenticate, authorize('admin', 'editor'), updateFeedback);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteFeedback);

module.exports = router;
