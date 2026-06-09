const router = require('express').Router();
const { createLead, getLeads, getLeadById, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads, streamLeads, getLeadNotes, addLeadNote, deleteLeadNote } = require('../controllers/leadController');
const { authenticate, authenticateSSE } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, authLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Gestión de contactos y citas
 */

router.post('/',          authLimiter, createLead);
router.get('/stream',     apiLimiter, authenticateSSE, authorize('admin', 'editor'), streamLeads);
router.get('/',           apiLimiter, authenticate, authorize('admin', 'editor'), getLeads);
router.patch('/batch',    apiLimiter, authenticate, authorize('admin', 'editor'), batchUpdateLeads);
router.delete('/batch',   apiLimiter, authenticate, authorize('admin'), batchDeleteLeads);
router.get('/:id',             apiLimiter, authenticate, authorize('admin', 'editor'), getLeadById);
router.put('/:id',             apiLimiter, authenticate, authorize('admin', 'editor'), updateLead);
router.delete('/:id',          apiLimiter, authenticate, authorize('admin'), deleteLead);
router.get('/:id/notes',       apiLimiter, authenticate, authorize('admin', 'editor'), getLeadNotes);
router.post('/:id/notes',      apiLimiter, authenticate, authorize('admin', 'editor'), addLeadNote);
router.delete('/:id/notes/:noteId', apiLimiter, authenticate, authorize('admin', 'editor'), deleteLeadNote);

module.exports = router;
