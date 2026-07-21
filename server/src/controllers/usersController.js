const { cloudinary } = require('../config/cloudinary');
const { User } = require('../models/index');
const { generateToken, hashPassword, comparePassword } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  profilePhoto: user.profilePhoto,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
});

// GET /api/users
const getUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'ASC']],
    });
    return res.json({ data: users });
  } catch (error) {
    console.error('Error en getUsers:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'editor',
    });

    logAudit(req, 'create', 'user', user.id, {
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({ message: 'Usuario creado exitosamente', data: safeUser(user) });
  } catch (error) {
    console.error('Error en createUser:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { name, email, role, isActive, newPassword, currentPassword } = req.body;

    if (email && email !== user.email) {
      const existing = await User.findOne({ where: { email } });
      if (existing) return res.status(409).json({ error: 'El email ya está en uso' });
    }

    // AUDIT-022: el admin principal (ID más bajo) no puede perder el rol de admin ni
    // ser desactivado por otro usuario — evita que el sistema quede sin administradores.
    if ((role && role !== 'admin') || isActive === false) {
      const masterAdmin = await User.findOne({ order: [['id', 'ASC']] });
      if (masterAdmin && masterAdmin.id === user.id) {
        return res
          .status(403)
          .json({ error: 'No se puede quitar el rol de admin ni desactivar al admin principal' });
      }
    }

    // AUDIT-023: cambios sensibles (password/rol/desactivación) invalidan los JWT ya
    // emitidos para este usuario, incrementando tokenVersion — ver authMiddleware.js.
    const isSensitiveChange =
      Boolean(newPassword) || (role && role !== user.role) || isActive === false;

    // Cambio de contraseña requiere verificar la actual si lo hace el propio usuario
    if (newPassword) {
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }
      if (req.user.id === user.id) {
        if (!currentPassword)
          return res.status(400).json({ error: 'Se requiere la contraseña actual' });
        const isMatch = await comparePassword(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
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
        try {
          await cloudinary.uploader.destroy(filename);
        } catch {
          /* ignorado */
        }
      }

      const result = await uploadToCloudinary(req.file.buffer);
      profilePhoto = result.secure_url;
    }

    await user.update({
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
      ...(isSensitiveChange && { tokenVersion: user.tokenVersion + 1 }),
      profilePhoto,
    });

    logAudit(req, 'update', 'user', user.id, {
      ...(name && { name }),
      ...(email && { email }),
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
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
  } catch (error) {
    console.error('Error en updateUser:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/users/:id  (desactivar, no eliminar físicamente)
const deactivateUser = async (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    const masterAdmin = await User.findOne({ order: [['id', 'ASC']] });
    if (masterAdmin && masterAdmin.id === parseInt(req.params.id)) {
      return res.status(403).json({ error: 'No se puede desactivar al admin principal' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await user.update({ isActive: false, tokenVersion: user.tokenVersion + 1 });
    logAudit(req, 'update', 'user', user.id, { isActive: false });
    return res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    console.error('Error en deactivateUser:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/users/:id/activate
const activateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await user.update({ isActive: true });
    logAudit(req, 'update', 'user', user.id, { isActive: true });
    return res.json({ message: 'Usuario activado exitosamente' });
  } catch (error) {
    console.error('Error en activateUser:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/users/:id/permanent
const permanentDeleteUser = async (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    // El admin principal es el usuario con el ID más bajo — protegido
    const masterAdmin = await User.findOne({ order: [['id', 'ASC']] });
    if (masterAdmin && masterAdmin.id === parseInt(req.params.id)) {
      return res.status(403).json({ error: 'No se puede eliminar al admin principal' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (user.profilePhoto) {
      const parts = user.profilePhoto.split('/');
      const filename = parts
        .slice(-2)
        .join('/')
        .replace(/\.[^.]+$/, '');
      try {
        await cloudinary.uploader.destroy(filename);
      } catch {
        /* ignorado */
      }
    }

    await user.destroy();
    logAudit(req, 'delete', 'user', req.params.id, {
      name: user.name,
      email: user.email,
      role: user.role,
    });
    return res.json({ message: 'Usuario eliminado permanentemente' });
  } catch (error) {
    console.error('Error en permanentDeleteUser:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  permanentDeleteUser,
};
