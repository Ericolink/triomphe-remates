const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const JWT_TOKEN_REGEX = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Formato de token inválido' });
    }

    const token = authHeader.slice(7).trim();

    // Validar formato JWT antes de verificar — previene ReDoS y bypass
    if (!token || !JWT_TOKEN_REGEX.test(token)) {
      return res.status(401).json({ error: 'Token malformado' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (!decoded || typeof decoded.id !== 'number' || decoded.id <= 0) {
      return res.status(401).json({ error: 'Token malformado' });
    }

    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Usuario no autorizado' });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Error de autenticación' });
  }
};

module.exports = { authenticate };
