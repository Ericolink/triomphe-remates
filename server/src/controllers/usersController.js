const { cloudinary } = require('../config/cloudinary');
const { User } = require('../models/index');
const { generateToken, hashPassword, comparePassword } = require('../utils/helpers');
const { logAudit, snapshotFields, buildChanges } = require('../utils/audit');
const { destroyCloudinaryAsset } = require('../utils/cloudinaryCleanup');
const { paginate } = require('../utils/pagination');
const userService = require('../services/userService');
const { ApiError } = require('../middleware/errorHandler');

// Reexportados desde userService para no duplicar la lista/función — updateUser
// y createUser comparten estas reglas de negocio.
const { VALID_ROLES, safeUser } = userService;

// GET /api/users
const getUsers = async (req, res) => {
  const { page, limit } = req.query;
  const queryOptions = {
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'ASC']],
  };

  // page/limit son opcionales: sin ellos se devuelve la lista completa, igual que
  // antes — varios selectores de "responsable" (CreateLeadModal, CasosExitoSection,
  // ProspectosSection) dependen de recibir todos los usuarios de una sola vez.
  if (page === undefined && limit === undefined) {
    const users = await User.findAll(queryOptions);
    return res.json({ data: users });
  }

  const result = await paginate(User, { page, limit, ...queryOptions });
  return res.json(result);
};

// POST /api/users
const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Nombre, email y contraseña son requeridos');
  }
  if (password.length < 8) {
    throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
  }

  let user;
  try {
    user = await userService.createUser(
      { name, email, password, role },
      {
        audit: (created) =>
          logAudit(req, 'create', 'user', created.id, {
            name: created.name,
            email: created.email,
            role: created.role,
          }),
      }
    );
  } catch (err) {
    if (err.code === 'INVALID_ROLE') throw new ApiError(400, err.message);
    if (err.code === 'DUPLICATE_EMAIL') throw new ApiError(409, err.message);
    throw err;
  }

  return res.status(201).json({ message: 'Usuario creado exitosamente', data: safeUser(user) });
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado');

  const { name, email, role, isActive, newPassword, currentPassword } = req.body;

  if (email && email !== user.email) {
    const existing = await User.findOne({ where: { email } });
    if (existing) throw new ApiError(409, 'El email ya está en uso');
  }
  if (role && !VALID_ROLES.includes(role)) {
    throw new ApiError(400, `Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}`);
  }

  // AUDIT-022: el admin principal (ID más bajo) no puede perder el rol de admin ni
  // ser desactivado por otro usuario — evita que el sistema quede sin administradores.
  if ((role && role !== 'admin') || isActive === false) {
    const masterAdmin = await User.findOne({ order: [['id', 'ASC']] });
    if (masterAdmin && masterAdmin.id === user.id) {
      throw new ApiError(403, 'No se puede quitar el rol de admin ni desactivar al admin principal');
    }
  }

  // AUDIT-023: cambios sensibles (password/rol/desactivación) invalidan los JWT ya
  // emitidos para este usuario, incrementando tokenVersion — ver authMiddleware.js.
  const isSensitiveChange =
    Boolean(newPassword) || (role && role !== user.role) || isActive === false;

  // Cambio de contraseña requiere verificar la actual si lo hace el propio usuario
  if (newPassword) {
    if (newPassword.length < 8) {
      throw new ApiError(400, 'La contraseña debe tener al menos 8 caracteres');
    }
    if (req.user.id === user.id) {
      if (!currentPassword) throw new ApiError(400, 'Se requiere la contraseña actual');
      const isMatch = await comparePassword(currentPassword, user.password);
      // Mismo `code` que authController.changePassword — ambos endpoints permiten a un
      // usuario cambiar su propia contraseña, y ambos deben distinguirse de "sesión
      // inválida" ante el interceptor global de axios (ver client/src/services/api.js).
      if (!isMatch) {
        logAudit(req, 'update', 'user', user.id, { event: 'change_password_failed' }, 'failed');
        throw new ApiError(401, 'Contraseña actual incorrecta', { code: 'INVALID_CURRENT_PASSWORD' });
      }
    }
    const hashed = await hashPassword(newPassword);
    await user.update({ password: hashed });
  }

  // Subida de foto de perfil
  let profilePhoto = user.profilePhoto;
  if (req.file) {
    const uploadToCloudinary = (buffer) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'triomphe/avatars',
            transformation: [{ width: 200, height: 200, crop: 'fill', quality: 'auto' }],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(buffer);
      });

    // Eliminar foto anterior si existe
    if (user.profilePhoto) {
      const parts = user.profilePhoto.split('/');
      const filename = parts
        .slice(-2)
        .join('/')
        .replace(/\.[^.]+$/, '');
      await destroyCloudinaryAsset(filename, {
        controller: 'usersController',
        operation: 'updateUser',
        resourceId: user.id,
      });
    }

    const result = await uploadToCloudinary(req.file.buffer);
    profilePhoto = result.secure_url;
  }

  const beforeSnapshot = snapshotFields(user, ['name', 'email', 'role', 'isActive', 'profilePhoto']);

  await user.update({
    ...(name && { name }),
    ...(email && { email }),
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
    ...(isSensitiveChange && { tokenVersion: user.tokenVersion + 1 }),
    profilePhoto,
  });

  logAudit(req, 'update', 'user', user.id, {
    changes: buildChanges(beforeSnapshot, user),
    ...(newPassword && { passwordChanged: true }),
  });

  // Si el propio usuario cambió su contraseña/rol, su token actual quedó invalidado
  // por el incremento de tokenVersion — se reemite uno nuevo para no cerrarle la sesión.
  const response = { message: 'Usuario actualizado exitosamente', data: safeUser(user) };
  if (isSensitiveChange && req.user.id === user.id) {
    response.token = generateToken({
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
  }

  return res.json(response);
};

// DELETE /api/users/:id  (desactivar, no eliminar físicamente)
const deactivateUser = async (req, res) => {
  if (req.user.id === parseInt(req.params.id)) {
    throw new ApiError(400, 'No puedes desactivar tu propia cuenta');
  }

  const masterAdmin = await User.findOne({ order: [['id', 'ASC']] });
  if (masterAdmin && masterAdmin.id === parseInt(req.params.id)) {
    throw new ApiError(403, 'No se puede desactivar al admin principal');
  }

  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado');

  await user.update({ isActive: false, tokenVersion: user.tokenVersion + 1 });
  logAudit(req, 'update', 'user', user.id, { isActive: false });
  return res.json({ message: 'Usuario desactivado exitosamente' });
};

// PUT /api/users/:id/activate
const activateUser = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado');

  await user.update({ isActive: true });
  logAudit(req, 'update', 'user', user.id, { isActive: true });
  return res.json({ message: 'Usuario activado exitosamente' });
};

// DELETE /api/users/:id/permanent
const permanentDeleteUser = async (req, res) => {
  if (req.user.id === parseInt(req.params.id)) {
    throw new ApiError(400, 'No puedes eliminar tu propia cuenta');
  }

  // El admin principal es el usuario con el ID más bajo — protegido
  const masterAdmin = await User.findOne({ order: [['id', 'ASC']] });
  if (masterAdmin && masterAdmin.id === parseInt(req.params.id)) {
    throw new ApiError(403, 'No se puede eliminar al admin principal');
  }

  const user = await User.findByPk(req.params.id);
  if (!user) throw new ApiError(404, 'Usuario no encontrado');

  if (user.profilePhoto) {
    const parts = user.profilePhoto.split('/');
    const filename = parts
      .slice(-2)
      .join('/')
      .replace(/\.[^.]+$/, '');
    await destroyCloudinaryAsset(filename, {
      controller: 'usersController',
      operation: 'permanentDeleteUser',
      resourceId: user.id,
    });
  }

  await user.destroy();
  logAudit(req, 'delete', 'user', req.params.id, {
    name: user.name,
    email: user.email,
    role: user.role,
  });
  return res.json({ message: 'Usuario eliminado permanentemente' });
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  permanentDeleteUser,
};
