const router = require('express').Router();
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { authLimiter, apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Autenticación de usuarios
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [admin, editor] }
 *     responses:
 *       201: { description: Usuario creado }
 *       400: { description: Datos inválidos }
 *       409: { description: Email ya registrado }
 */
router.post('/register', authLimiter, register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login exitoso con token JWT }
 *       401: { description: Credenciales inválidas }
 */
router.post('/login', authLimiter, login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtener usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Datos del usuario }
 *       401: { description: No autenticado }
 */
router.get('/me', apiLimiter, authenticate, getMe);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Cambiar contraseña
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Contraseña actualizada }
 */
router.put('/change-password', authLimiter, authenticate, changePassword);

module.exports = router;
