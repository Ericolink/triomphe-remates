const router = require('express').Router();
const { createLead, getLeads, getLeadById, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads } = require('../controllers/leadController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, authLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Gestión de contactos y citas
 */

router.post('/',          authLimiter, createLead);
router.get('/',           apiLimiter, authenticate, authorize('admin', 'editor'), getLeads);
router.patch('/batch',    apiLimiter, authenticate, authorize('admin', 'editor'), batchUpdateLeads);
router.delete('/batch',   apiLimiter, authenticate, authorize('admin'), batchDeleteLeads);
router.get('/:id',        apiLimiter, authenticate, authorize('admin', 'editor'), getLeadById);
router.put('/:id',        apiLimiter, authenticate, authorize('admin', 'editor'), updateLead);
router.delete('/:id',     apiLimiter, authenticate, authorize('admin'), deleteLead);

module.exports = router;
