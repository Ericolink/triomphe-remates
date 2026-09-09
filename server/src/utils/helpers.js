const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// Duración en ms de JWT_EXPIRES_IN (mismo valor que `expiresIn` usa arriba para firmar) —
// usado por sessionService.js para que `UserSession.expiresAt` quede alineado con la
// expiración real del JWT emitido, sin depender de `ms` (dependencia transitiva de
// jsonwebtoken, no declarada como propia — ver AUDITORIA de la feature de sesiones). Solo
// necesita cubrir el vocabulario que nosotros mismos ponemos en .env (ej. "7d"), no el
// formato completo de `ms`.
const DURATION_UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

const parseExpiresInMs = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  const match = /^(\d+)\s*([smhdw])?$/i.exec(String(value || '').trim());
  if (!match) return 7 * DURATION_UNIT_MS.d; // fallback defensivo, no debería alcanzarse: validateEnv.js exige JWT_EXPIRES_IN
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  return amount * DURATION_UNIT_MS[unit];
};

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

const generateSlug = (text) => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

module.exports = { generateToken, hashPassword, comparePassword, generateSlug, parseExpiresInMs };
