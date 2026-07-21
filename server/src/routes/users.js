const router = require('express').Router();
const {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  permanentDeleteUser,
} = require('../controllers/usersController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimitMiddleware');

// Todas las rutas requieren admin
router.get('/', apiLimiter, authenticate, authorize('admin'), getUsers);
router.post('/', apiLimiter, authenticate, authorize('admin'), createUser);
router.put(
  '/:id',
  uploadLimiter,
  authenticate,
  authorize('admin'),
  upload.single('profilePhoto'),
  updateUser
);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deactivateUser);
router.put('/:id/activate', apiLimiter, authenticate, authorize('admin'), activateUser);
router.delete('/:id/permanent', apiLimiter, authenticate, authorize('admin'), permanentDeleteUser);

module.exports = router;
