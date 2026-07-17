const router = require('express').Router();
const { getAppointments, createAppointment, updateAppointmentStatus, rescheduleAppointment, deleteAppointment } = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Citas de prospectos (CRM Comercial) — alimenta el Calendario
 */

router.get('/',    apiLimiter, authenticate, authorize('admin', 'editor'), getAppointments);
router.post('/',   apiLimiter, authenticate, authorize('admin', 'editor'), createAppointment);
router.patch('/:id', apiLimiter, authenticate, authorize('admin', 'editor'), updateAppointmentStatus);
router.post('/:id/reschedule', apiLimiter, authenticate, authorize('admin', 'editor'), rescheduleAppointment);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteAppointment);

module.exports = router;
