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

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestión de usuarios del panel admin (único endpoint de alta usado por el frontend — ver AUDITORIA_CREACION_USUARIOS.md)
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar usuarios
 *     description: "Sin `page`/`limit` devuelve la lista completa (`{ data: User[] }`); con alguno de los dos, respuesta paginada."
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Opcional. Si se omite junto con `limit`, se devuelve la colección completa sin paginar.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Máximo 100 por página.
 *     responses:
 *       200:
 *         description: Lista de usuarios (forma varía según se haya pedido paginación, ver arriba)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 totalPages: { type: integer }
 *                 hasNext: { type: boolean }
 *                 hasPrevious: { type: boolean }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No autorizado (admin o asistente_administrativo), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   post:
 *     summary: Crear usuario (endpoint usado por el panel admin)
 *     description: >
 *       Único endpoint de alta de usuarios consumido por el frontend (`UsersPage.jsx` vía `usersService.js`).
 *       Registra en la bitácora de auditoría (`logAudit`).
 *       Ver también `POST /api/auth/register`, que cubre el mismo caso de uso de forma legacy.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: 'Juana Pérez' }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role:
 *                 type: string
 *                 enum: [admin, coordinador_ventas, asesor_ventas, asistente_administrativo]
 *                 default: asistente_administrativo
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Usuario creado exitosamente' }
 *                 data: { $ref: '#/components/schemas/User' }
 *       400: { description: 'Datos inválidos (faltan campos, password corta, o rol fuera de la whitelist)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No autorizado (solo admin), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Email ya registrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Actualizar usuario (datos, rol, contraseña o foto de perfil)
 *     description: >
 *       Todos los campos son opcionales — solo se actualiza lo enviado. Cambiar `newPassword`, `role`
 *       o desactivar (`isActive: false`) invalida los tokens ya emitidos del usuario (tokenVersion++).
 *       El admin principal (ID más bajo) no puede perder el rol admin ni ser desactivado.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               role:
 *                 type: string
 *                 enum: [admin, coordinador_ventas, asesor_ventas, asistente_administrativo]
 *               isActive: { type: boolean }
 *               newPassword: { type: string, minLength: 8 }
 *               currentPassword:
 *                 type: string
 *                 description: Requerida solo si el propio usuario autenticado cambia su contraseña
 *               profilePhoto: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente. Incluye `token` nuevo solo si el propio usuario se actualizó a sí mismo con un cambio sensible.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Usuario actualizado exitosamente' }
 *                 data: { $ref: '#/components/schemas/User' }
 *                 token: { type: string, description: 'JWT reemitido, solo presente si aplica' }
 *       400: { description: 'Datos inválidos (password corta, rol inválido, falta currentPassword)', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: 'No autenticado, o currentPassword incorrecta', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: 'No autorizado, o intento de modificar al admin principal', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Email ya está en uso, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *   delete:
 *     summary: Desactivar usuario (soft delete)
 *     description: "No elimina el registro, solo pone `isActive: false`. No se puede desactivar la propia cuenta ni al admin principal."
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Usuario desactivado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Usuario desactivado exitosamente' }
 *       400: { description: No puedes desactivar tu propia cuenta, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: 'No autorizado, o intento de desactivar al admin principal', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */

/**
 * @swagger
 * /api/users/{id}/activate:
 *   put:
 *     summary: Reactivar usuario previamente desactivado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Usuario activado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Usuario activado exitosamente' }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: No autorizado (solo admin), content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */

/**
 * @swagger
 * /api/users/{id}/permanent:
 *   delete:
 *     summary: Eliminar usuario permanentemente (hard delete)
 *     description: Elimina el registro y su foto de perfil en Cloudinary si existe. No se puede eliminar la propia cuenta ni al admin principal.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Usuario eliminado permanentemente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: 'Usuario eliminado permanentemente' }
 *       400: { description: No puedes eliminar tu propia cuenta, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       401: { description: No autenticado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       403: { description: 'No autorizado, o intento de eliminar al admin principal', content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       404: { description: Usuario no encontrado, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 */

// Listar queda abierto también a asistente_administrativo y coordinador_ventas — sin esto,
// el selector de "responsable" del CRM (CreateLeadModal/LeadDetailPanel/ProspectosSection,
// ver comentario en usersController.getUsers) le llegaba vacío, aunque canAssignLeads() ya
// los autorizaba a asignar/reasignar prospectos (ver leadAccess.js). Un coordinador recibe
// solo su propio equipo, no el roster completo — ver el filtro dentro de getUsers.
// Alta/edición/baja de cuentas se queda admin-only.
router.get(
  '/',
  apiLimiter,
  authenticate,
  authorize('admin', 'asistente_administrativo', 'coordinador_ventas'),
  getUsers
);
router.post('/', apiLimiter, authenticate, authorize('admin'), createUser);
router.put(
  '/:id',
  uploadLimiter,
  authenticate,
  authorize('admin'),
  upload.single('profilePhoto'),
  upload.validateImageSignature,
  updateUser
);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deactivateUser);
router.put('/:id/activate', apiLimiter, authenticate, authorize('admin'), activateUser);
router.delete('/:id/permanent', apiLimiter, authenticate, authorize('admin'), permanentDeleteUser);

module.exports = router;
