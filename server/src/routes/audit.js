const router = require('express').Router();
const { getAuditLogs, getAuditSummary } = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

router.get('/', apiLimiter, authenticate, authorize('admin'), getAuditLogs);
router.get('/summary', apiLimiter, authenticate, authorize('admin'), getAuditSummary);

module.exports = router;
