const router = require('express').Router();
const {
  getAppointments,
  createAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
} = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Citas de prospectos (CRM Comercial) — alimenta el Calendario
 */

router.get('/', apiLimiter, authenticate, requireCrmAccess, getAppointments);
router.post('/', apiLimiter, authenticate, requireCrmAccess, createAppointment);
router.patch('/:id', apiLimiter, authenticate, requireCrmAccess, updateAppointmentStatus);
router.post('/:id/reschedule', apiLimiter, authenticate, requireCrmAccess, rescheduleAppointment);
router.delete('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), deleteAppointment);

module.exports = router;
