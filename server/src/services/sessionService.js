// Único punto que lee/escribe UserSession directamente — mismo criterio que
// settingsService.js para Setting. authMiddleware.js y authController.js (y el resto de
// puntos que hoy incrementan tokenVersion) pasan por aquí, nunca por el modelo a mano.
//
// Relación con tokenVersion (ver authMiddleware.js): tokenVersion sigue siendo el mecanismo
// de invalidación GLOBAL (todo lo emitido para el usuario), sin ningún cambio de
// comportamiento. UserSession añade una capa por-dispositivo encima: cada fila es un login,
// su `id` es el claim `sid` del JWT, y se puede revocar una sola sin tocar tokenVersion —
// eso es lo que tokenVersion, por diseño (un contador único por usuario), no puede hacer.
const { Op } = require('sequelize');
const { UserSession } = require('../models/index');
const { resolveClientIp } = require('../middleware/rateLimitMiddleware');
const { parseUserAgent } = require('../utils/userAgentInfo');
const { parseExpiresInMs } = require('../utils/helpers');
const logger = require('../utils/logger');

// Ventana mínima entre escrituras de `lastActivity` por sesión — evita un UPDATE en cada
// request autenticado (que puede ser varios por segundo en uso normal del panel) a cambio
// de una precisión que la UI no necesita ("Hace 5 minutos" no distingue entre hace 30s y
// hace 4 minutos).
const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

async function createSession({ userId, req }) {
  const { device, browser } = parseUserAgent(req.headers['user-agent']);
  const now = new Date();
  return UserSession.create({
    userId,
    userAgent: (req.headers['user-agent'] || '').slice(0, 255) || null,
    device,
    browser,
    ip: resolveClientIp(req),
    lastActivity: now,
    expiresAt: new Date(now.getTime() + parseExpiresInMs(process.env.JWT_EXPIRES_IN)),
  });
}

// Usado por authMiddleware.js en cada request autenticado. `decoded.sid == null` cubre
// tokens emitidos antes de este cambio (mismo criterio de compatibilidad que
// `decoded.tokenVersion ?? 0`) — no rompe sesiones ya abiertas al desplegar esta feature.
async function resolveActiveSession(decoded) {
  if (decoded.sid == null) return { session: null };

  const session = await UserSession.findByPk(decoded.sid);
  const isValid =
    !!session &&
    session.userId === decoded.id &&
    !session.revokedAt &&
    session.expiresAt.getTime() > Date.now();

  if (!isValid) return { invalid: true };
  return { session };
}

// Fire-and-forget a propósito: no debe agregar latencia a requests autenticados normales.
// Solo escribe cuando ya pasó la ventana de throttling — la mayoría de los requests no
// generan ningún UPDATE.
function touchActivity(session, req) {
  if (!session) return;
  const now = Date.now();
  if (now - session.lastActivity.getTime() < ACTIVITY_UPDATE_INTERVAL_MS) return;

  session
    .update({ lastActivity: new Date(now), ip: resolveClientIp(req) })
    .catch((err) => logger.error('session_touch_activity_failed', { sessionId: session.id, error: err.message }));
}

async function listActiveSessions(userId) {
  return UserSession.findAll({
    where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    order: [['lastActivity', 'DESC']],
  });
}

// Devuelve un resultado tipado en vez de lanzar, para que el controller decida 404 vs 403
// (mismo criterio que las verificaciones de ownership en leadController.js/dealController.js:
// 404 si el recurso no existe, 403 si existe pero no es del usuario).
async function revokeSession({ userId, sessionId }) {
  const session = await UserSession.findByPk(sessionId);
  if (!session) return 'not_found';
  if (session.userId !== userId) return 'forbidden';
  if (!session.revokedAt) await session.update({ revokedAt: new Date() });
  return 'ok';
}

async function revokeOtherSessions({ userId, exceptSessionId }) {
  const [count] = await UserSession.update(
    { revokedAt: new Date() },
    {
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId != null && { id: { [Op.ne]: exceptSessionId } }),
      },
    }
  );
  return count;
}

// Usado por los puntos que ya incrementan tokenVersion (changePassword, updateUser,
// deactivateUser) — mantiene la lista de "sesiones activas" honesta: sin esto, una sesión ya
// muerta por tokenVersion seguiría apareciendo como activa hasta su expiración natural.
async function revokeAllSessions({ userId, exceptSessionId = null }) {
  return revokeOtherSessions({ userId, exceptSessionId });
}

module.exports = {
  createSession,
  resolveActiveSession,
  touchActivity,
  listActiveSessions,
  revokeSession,
  revokeOtherSessions,
  revokeAllSessions,
};
