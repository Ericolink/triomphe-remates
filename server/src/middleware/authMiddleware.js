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

// Variante para conexiones SSE — EventSource no permite enviar encabezados
// personalizados, así que el token también puede llegar por query string
const authenticateSSE = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const headerToken = authHeader.replace('Bearer ', '').trim();
    const token = headerToken || (req.query.token || '').toString().trim();

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

// Adjunta req.user si hay un token válido, sin bloquear la petición si no lo hay
const attachUserIfPresent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (user && user.isActive) req.user = user;
    return next();
  } catch {
    return next();
  }
};

module.exports = { authenticate, attachUserIfPresent, authenticateSSE };
