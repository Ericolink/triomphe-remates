const router = require('express').Router();
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { requestTimeout } = require('../middleware/requestTimeout');
const {
  authLimiter,
  loginLimiter,
  loginAccountLimiter,
  apiLimiter,
  changePasswordLimiter,
} = require('../middleware/rateLimitMiddleware');

// Timeout del endpoint de login — ver requestTimeout.js. 10s da margen holgado sobre lo que
// tarda hoy un login normal (bcrypt.compare ~100-300ms + una query indexada por email) sin
// dejar la conexión abierta indefinidamente si MySQL se cuelga.
const LOGIN_TIMEOUT_MS = 10_000;

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
 *     summary: "[DEPRECADO] Registrar nuevo usuario (solo admin)"
 *     deprecated: true
 *     description: >
 *       **Endpoint legacy, sin consumidor conocido en el frontend.** Use `POST /api/users` para
 *       crear usuarios desde el panel admin — tiene mejor UX (auditoría en `logAudit`, respuesta
 *       saneada vía `safeUser()`) y es el único endpoint que el frontend (`UsersPage.jsx`) invoca
 *       hoy. `register` no escribe en la bitácora de auditoría. Ver `AUDITORIA_CREACION_USUARIOS.md`
 *       para el análisis completo; el uso de este endpoint se está instrumentando temporalmente
 *       (`legacy_register_endpoint_used`) antes de una eventual eliminación.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
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
 *               role:
 *                 type: string
 *                 enum: [admin, coordinador_ventas, asesor_ventas, asistente_administrativo]
 *     responses:
 *       201:
 *         description: Usuario creado. A diferencia de `POST /api/users`, devuelve un JWT nuevo para el usuario recién creado en vez de sus datos saneados.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 token: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     role:
 *                       type: string
 *                       enum: [admin, coordinador_ventas, asesor_ventas, asistente_administrativo]
 *       400: { description: Datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No autorizado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Email ya registrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */
router.post('/register', authLimiter, authenticate, authorize('admin'), register);

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
 *       429:
 *         description: >
 *           Demasiados intentos fallidos. Tres capas de límite conviven aquí (ver
 *           rateLimitMiddleware.js): authLimiter (20/15min por IP, anti-scanning general,
 *           compartido con /register), loginLimiter (5/15min por IP+email, el "bloqueo de
 *           cuenta" puntual) y loginAccountLimiter (15/15min por email únicamente, red de
 *           seguridad contra fuerza bruta distribuida entre varias IPs). Incluye
 *           `Retry-After` en segundos.
 *         headers:
 *           Retry-After: { schema: { type: integer } }
 */
router.post('/login', requestTimeout(LOGIN_TIMEOUT_MS), authLimiter, loginLimiter, loginAccountLimiter, login);

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Contraseña actualizada. Se devuelve un JWT nuevo — el anterior queda invalidado (tokenVersion).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 token: { type: string }
 *       400: { description: La nueva contraseña no cumple los requisitos mínimos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401:
 *         description: >
 *           Dos causas posibles bajo el mismo statusCode, distinguidas por `code`: `INVALID_CURRENT_PASSWORD`
 *           (la contraseña actual no coincide — el token sigue siendo válido, no debe cerrar sesión) o
 *           `INVALID_SESSION` (token ausente/inválido/expirado, emitido por `authMiddleware` antes de
 *           llegar al controlador — sí debe cerrar sesión). El interceptor global de axios del frontend
 *           (`client/src/services/api.js`) usa `code` para decidir, no el texto de `error`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 code: { type: string, enum: [INVALID_CURRENT_PASSWORD, INVALID_SESSION] }
 */
router.put('/change-password', changePasswordLimiter, authenticate, changePassword);

module.exports = router;
