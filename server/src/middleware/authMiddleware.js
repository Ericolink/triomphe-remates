const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.slice(7);

    if (!token || token.length === 0) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    if (!decoded.id || typeof decoded.id !== 'number') {
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
