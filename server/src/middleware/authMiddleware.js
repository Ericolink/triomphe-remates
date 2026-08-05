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

    // AUDIT-023: tokens emitidos antes de un cambio de password/rol/desactivación
    // quedan invalidados aunque no hayan expirado — decoded.tokenVersion ausente
    // (tokens emitidos antes de este cambio) se trata como 0 para no cerrar sesión
    // a todos los usuarios ya logueados en el momento del deploy.
    if (!user || !user.isActive || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
      // `code: 'INVALID_SESSION'` marca este 401 como "sesión inválida/expirada" para el
      // interceptor global de axios (client/src/services/api.js) — es el único statusCode+code
      // que dispara logout automático. Cualquier controlador que quiera devolver 401 sin
      // cerrar sesión (ej. authController.changePassword) debe usar un `code` distinto.
      return res.status(401).json({ error: 'Usuario no autorizado', code: 'INVALID_SESSION' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'No autorizado', code: 'INVALID_SESSION' });
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

    if (!user || !user.isActive || (decoded.tokenVersion ?? 0) !== user.tokenVersion) {
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

    if (user && user.isActive && (decoded.tokenVersion ?? 0) === user.tokenVersion) req.user = user;
    return next();
  } catch {
    return next();
  }
};

module.exports = { authenticate, attachUserIfPresent, authenticateSSE };
