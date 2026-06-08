const { User } = require('../models/index');
const { generateToken, hashPassword, comparePassword } = require('../utils/helpers');
const { validateRegister, validateLogin } = require('../utils/validators');
const { logAudit } = require('../utils/audit');

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const errors = validateRegister(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });

    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({ name, email, password: hashedPassword, role });

    const token = generateToken({ id: user.id, role: user.role });

    return res.status(201).json({
      message: 'Usuario creado exitosamente',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en register:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const errors = validateLogin(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });

    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await user.update({ lastLogin: new Date() });
    logAudit({ user, ip: req.ip }, 'login', 'user', user.id, { email: user.email });

    const token = generateToken({ id: user.id, role: user.role });

    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return res.json({ user: req.user });
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const user = await User.findByPk(req.user.id);
    const isMatch = await comparePassword(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await user.update({ password: hashedPassword });

    return res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error en changePassword:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, login, getMe, changePassword };
