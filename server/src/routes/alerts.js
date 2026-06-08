const router = require('express').Router();
const { subscribe, unsubscribe, getAlerts, deleteAlert } = require('../controllers/alertController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, authLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/',              authLimiter, subscribe);
router.get('/unsubscribe',    apiLimiter,  unsubscribe);
router.get('/',               apiLimiter,  authenticate, authorize('admin', 'editor'), getAlerts);
router.delete('/:id',         apiLimiter,  authenticate, authorize('admin'), deleteAlert);

module.exports = router;
