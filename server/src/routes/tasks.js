const router = require('express').Router();
const { getTasks, completeTask, reassignTask } = require('../controllers/taskController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Próxima acción de un prospecto (CRM Comercial)
 */

router.get('/', apiLimiter, authenticate, authorize('admin', 'editor'), getTasks);
router.patch('/:id/complete', apiLimiter, authenticate, authorize('admin', 'editor'), completeTask);
router.patch('/:id/reassign', apiLimiter, authenticate, authorize('admin', 'editor'), reassignTask);

module.exports = router;
