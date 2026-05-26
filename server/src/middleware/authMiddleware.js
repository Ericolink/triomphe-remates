const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const authenticate = async (req, res, next) => {
  try {
    // Extraer token directamente — jwt.verify es la única validación de seguridad
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    // jwt.verify lanza excepción si el token es inválido — no hay bypass posible
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuario no autorizado' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'No autorizado' });
  }
};

module.exports = { authenticate };
