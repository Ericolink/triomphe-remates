const router = require('express').Router();
const { createLead, getLeads, getLeadById, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads, streamLeads, getLeadNotes, addLeadNote, deleteLeadNote, sendLeadWhatsApp, closeLeadAsWon, closeLeadAsLost, reopenLead } = require('../controllers/leadController');
const { addLeadProperty, removeLeadProperty } = require('../controllers/leadPropertyController');
const { getLeadActivities, createLeadActivity } = require('../controllers/activityController');
const { getLeadAppointments } = require('../controllers/appointmentController');
const { getLeadTasks } = require('../controllers/taskController');
const { authenticate, authenticateSSE } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter, publicFormLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Gestión de contactos y citas (CRM Comercial — "Prospectos" en la UI)
 */

router.post('/',          publicFormLimiter, createLead);
router.get('/stream',     apiLimiter, authenticateSSE, authorize('admin', 'editor'), streamLeads);
router.get('/',           apiLimiter, authenticate, authorize('admin', 'editor'), getLeads);
router.patch('/batch',    apiLimiter, authenticate, authorize('admin', 'editor'), batchUpdateLeads);
router.delete('/batch',   apiLimiter, authenticate, authorize('admin'), batchDeleteLeads);
router.get('/:id',             apiLimiter, authenticate, authorize('admin', 'editor'), getLeadById);
router.put('/:id',             apiLimiter, authenticate, authorize('admin', 'editor'), updateLead);
router.delete('/:id',          apiLimiter, authenticate, authorize('admin'), deleteLead);
router.put('/:id/close-won',   apiLimiter, authenticate, authorize('admin', 'editor'), closeLeadAsWon);
router.put('/:id/close-lost',  apiLimiter, authenticate, authorize('admin', 'editor'), closeLeadAsLost);
router.put('/:id/reopen',      apiLimiter, authenticate, authorize('admin', 'editor'), reopenLead);
router.get('/:id/notes',       apiLimiter, authenticate, authorize('admin', 'editor'), getLeadNotes);
router.post('/:id/notes',      apiLimiter, authenticate, authorize('admin', 'editor'), addLeadNote);
router.delete('/:id/notes/:noteId', apiLimiter, authenticate, authorize('admin', 'editor'), deleteLeadNote);
router.post('/:id/whatsapp',   apiLimiter, authenticate, authorize('admin', 'editor'), sendLeadWhatsApp);
router.post('/:id/properties',              apiLimiter, authenticate, authorize('admin', 'editor'), addLeadProperty);
router.delete('/:id/properties/:propertyId', apiLimiter, authenticate, authorize('admin', 'editor'), removeLeadProperty);
router.get('/:id/activities',  apiLimiter, authenticate, authorize('admin', 'editor'), getLeadActivities);
router.post('/:id/activities', apiLimiter, authenticate, authorize('admin', 'editor'), createLeadActivity);
router.get('/:id/appointments', apiLimiter, authenticate, authorize('admin', 'editor'), getLeadAppointments);
router.get('/:id/tasks',        apiLimiter, authenticate, authorize('admin', 'editor'), getLeadTasks);

module.exports = router;
