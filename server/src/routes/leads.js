const router = require('express').Router();
const {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  batchUpdateLeads,
  batchDeleteLeads,
  streamLeads,
  getLeadNotes,
  addLeadNote,
  deleteLeadNote,
  sendLeadWhatsApp,
  closeLeadAsWon,
  closeLeadAsLost,
  sendLeadToWaitingList,
  reopenLead,
} = require('../controllers/leadController');
const { addLeadProperty, removeLeadProperty } = require('../controllers/leadPropertyController');
const { getLeadActivities, createLeadActivity } = require('../controllers/activityController');
const { getLeadAppointments } = require('../controllers/appointmentController');
const { getLeadTasks } = require('../controllers/taskController');
const {
  authenticate,
  authenticateSSE,
  attachUserIfPresent,
} = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { apiLimiter, publicFormLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Gestión de contactos y citas (CRM Comercial — "Prospectos" en la UI)
 */

// attachUserIfPresent: esta ruta no requiere auth (también la usa el formulario público
// "Contactar asesor"), pero el CRM reusa el mismo endpoint para "Nuevo prospecto"
// (CreateLeadModal), donde el teléfono es intencionalmente opcional. Adjuntar req.user
// cuando hay un token válido es lo que le permite a createLead distinguir un envío del
// sitio público (teléfono obligatorio) de una captura manual del equipo comercial, y
// aplicar las reglas de rol de CRM (asesor no puede crear, etc.) cuando corresponde.
router.post('/', publicFormLimiter, attachUserIfPresent, createLead);
router.get('/stream', apiLimiter, authenticateSSE, requireCrmAccess, streamLeads);
router.get('/', apiLimiter, authenticate, requireCrmAccess, getLeads);
router.patch('/batch', apiLimiter, authenticate, requireCrmAccess, batchUpdateLeads);
router.delete(
  '/batch',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  batchDeleteLeads
);
router.get('/:id', apiLimiter, authenticate, requireCrmAccess, getLeadById);
router.put('/:id', apiLimiter, authenticate, requireCrmAccess, updateLead);
router.delete(
  '/:id',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  deleteLead
);
router.put('/:id/close-won', apiLimiter, authenticate, requireCrmAccess, closeLeadAsWon);
router.put('/:id/close-lost', apiLimiter, authenticate, requireCrmAccess, closeLeadAsLost);
router.put(
  '/:id/send-to-waiting-list',
  apiLimiter,
  authenticate,
  requireCrmAccess,
  sendLeadToWaitingList
);
router.put('/:id/reopen', apiLimiter, authenticate, requireCrmAccess, reopenLead);
router.get('/:id/notes', apiLimiter, authenticate, requireCrmAccess, getLeadNotes);
router.post('/:id/notes', apiLimiter, authenticate, requireCrmAccess, addLeadNote);
router.delete('/:id/notes/:noteId', apiLimiter, authenticate, requireCrmAccess, deleteLeadNote);
router.post('/:id/whatsapp', apiLimiter, authenticate, requireCrmAccess, sendLeadWhatsApp);
router.post('/:id/properties', apiLimiter, authenticate, requireCrmAccess, addLeadProperty);
router.delete(
  '/:id/properties/:propertyId',
  apiLimiter,
  authenticate,
  requireCrmAccess,
  removeLeadProperty
);
router.get('/:id/activities', apiLimiter, authenticate, requireCrmAccess, getLeadActivities);
router.post('/:id/activities', apiLimiter, authenticate, requireCrmAccess, createLeadActivity);
router.get('/:id/appointments', apiLimiter, authenticate, requireCrmAccess, getLeadAppointments);
router.get('/:id/tasks', apiLimiter, authenticate, requireCrmAccess, getLeadTasks);

module.exports = router;
