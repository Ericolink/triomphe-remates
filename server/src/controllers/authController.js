const { User } = require('../models/index');
const { generateToken, hashPassword, comparePassword } = require('../utils/helpers');
const { validateRegister, validateLogin } = require('../utils/validators');
const { logAudit } = require('../utils/audit');
const userService = require('../services/userService');

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const errors = validateRegister(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });

    const { name, email, password, role } = req.body;

    let user;
    try {
      // Sin `crmRole` ni `audit`: register nunca aceptó crmRole en el body ni
      // registró auditoría — se preserva ese comportamiento (ver reporte de
      // refactor, diferencia conservada intencionalmente por compatibilidad).
      user = await userService.createUser({ name, email, password, role });
    } catch (err) {
      if (err.code === 'DUPLICATE_EMAIL') {
        return res.status(409).json({ error: err.message });
      }
      throw err;
    }

    const token = generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

    return res.status(201).json({
      message: 'Usuario creado exitosamente',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        crmRole: user.crmRole,
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

    const token = generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        crmRole: user.crmRole,
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
      return res
        .status(400)
        .json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const user = await User.findByPk(req.user.id);
    const isMatch = await comparePassword(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await user.update({ password: hashedPassword, tokenVersion: user.tokenVersion + 1 });

    // El token actual quedó invalidado por el cambio de tokenVersion — se reemite uno
    // nuevo en la respuesta para que el usuario no se quede sin sesión tras el cambio.
    const token = generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

    return res.json({ message: 'Contraseña actualizada exitosamente', token });
  } catch (error) {
    console.error('Error en changePassword:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, login, getMe, changePassword };
