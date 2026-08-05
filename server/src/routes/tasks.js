const router = require('express').Router();
const { getTasks, completeTask, reassignTask } = require('../controllers/taskController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireCrmAccess } = require('../middleware/crmAccessMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Próxima acción de un prospecto (CRM Comercial)
 */

router.get('/', apiLimiter, authenticate, requireCrmAccess, getTasks);
router.patch('/:id/complete', apiLimiter, authenticate, requireCrmAccess, completeTask);
router.patch('/:id/reassign', apiLimiter, authenticate, requireCrmAccess, reassignTask);

module.exports = router;
