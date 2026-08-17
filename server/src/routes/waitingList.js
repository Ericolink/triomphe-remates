const router = require('express').Router();
const {
  getWaitingList,
  createWaitingListEntry,
  updateWaitingListEntry,
  deleteWaitingListEntry,
} = require('../controllers/waitingListController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: WaitingList
 *   description: Lista de espera de clientes esperando una propiedad a un precio específico (captura manual del staff, distinto de las alertas públicas del sitio)
 */

router.get(
  '/',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  getWaitingList
);
router.post(
  '/',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  createWaitingListEntry
);
router.put(
  '/:id',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  updateWaitingListEntry
);
router.delete(
  '/:id',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo'),
  deleteWaitingListEntry
);

module.exports = router;
