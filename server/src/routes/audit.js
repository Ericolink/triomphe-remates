const router = require('express').Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

router.get('/', apiLimiter, authenticate, authorize('admin'), getAuditLogs);

module.exports = router;
