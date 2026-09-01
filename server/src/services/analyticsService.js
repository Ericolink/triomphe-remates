// Núcleo compartido de la Fase 1 de analítica de tráfico — usado tanto por
// POST /api/analytics/events (endpoint genérico, público, valida estrictamente porque
// acepta cualquier payload de internet) como por trackView/trackShare en
// propertyController.js (rutas REST ya existentes, más permisivas porque migran tráfico
// que puede venir de un bundle de cliente viejo sin visitorId/sessionId todavía). Centralizar
// aquí evita que cada punto de entrada reimplemente su propia validación/dedup/bot-detection.
const { Op } = require('sequelize');
const { Analytics, Property } = require('../models/index');
const { ApiError } = require('../middleware/errorHandler');
const { parseUserAgent } = require('../utils/deviceParser');
const { isBotUserAgent } = require('../utils/botDetection');
const { extractReferrerHost } = require('../utils/referrerHost');
const logger = require('../utils/logger');

const ALLOWED_EVENTS = [
  'page_view',
  'property_view',
  'property_search',
  'property_filter',
  'whatsapp_click',
  'phone_click',
  'email_click',
  'property_share',
  'technical_sheet_download',
];

// Solo property_view se deduplica. Ajuste de producto (ver AUDITORIA de la Fase 1): incluir
// page_view aquí hacía que "Páginas vistas" no fuera una navegación real — un visitante que
// entra al catálogo, abre una propiedad, vuelve al catálogo, abre otra y vuelve de nuevo
// generaba una sola "vista" de /propiedades en vez de tres, porque cada regreso caía dentro
// de la misma ventana de 30 min que su primera visita a esa ruta. page_view ahora representa
// cada navegación real de React Router, sin deduplicar — el abuso/refresh-spam sigue
// contenido por analyticsLimiter (rate limit) y por isBotUserAgent, no por esta ventana.
//
// property_view SÍ se sigue deduplicando: ahí el objetivo es distinto — evitar que un
// refresh, un doble render de React StrictMode, o un reintento de red infle el contador de
// "veces que se vio esta propiedad", que es una métrica de interés/negocio, no de tráfico
// crudo de página.
const DEDUP_EVENTS = new Set(['property_view']);
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutos — solo aplica a property_view ahora

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const MAX_LEN = { path: 255, referrerHost: 255, utm: 150 };

const trimOrNull = (v, max) => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

// Igual que trimOrNull, pero RECHAZA (en vez de truncar) un valor más largo que el máximo —
// usada solo por la validación estricta del endpoint público: un campo desproporcionadamente
// largo es más probable que sea un payload malformado/abusivo que un dato legítimo, así que
// se prefiere devolver 400 a guardar una versión recortada silenciosamente.
const trimOrReject = (v, max, fieldName) => {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new ApiError(400, `${fieldName} inválido`);
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new ApiError(400, `${fieldName} excede el tamaño máximo`);
  return trimmed;
};

// El cliente ya manda solo el host (ver client/src/utils/analytics.js), pero se normaliza
// de nuevo aquí en el servidor por si acaso — nunca se confía en que un payload público
// venga bien formado. Si por error llegara una URL completa, se reduce a su host; nunca se
// persiste la URL tal cual. Recibe el valor YA recortado/validado (trimOrNull o
// trimOrReject, según qué tan estricto sea el caller) para no decidir dos veces si truncar
// o rechazar un valor largo.
const normalizeReferrerHost = (trimmedValue) => {
  if (!trimmedValue) return null;
  if (trimmedValue.includes('://') || trimmedValue.includes('/')) return extractReferrerHost(trimmedValue);
  const lower = trimmedValue.toLowerCase();
  return lower.startsWith('www.') ? lower.slice(4) : lower;
};

const normalizePropertyId = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined; // undefined = inválido
};

// Validación ESTRICTA — usada solo por el endpoint público genérico. Cualquier forma
// inesperada se rechaza con 400 en vez de aceptarse "a medias" (PASO de seguridad del brief:
// no aceptar eventos arbitrarios sin validar).
function sanitizeEventInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ApiError(400, 'Cuerpo de la solicitud inválido');
  }

  const { event, visitorId, sessionId, propertyId, path, referrerHost, utmSource, utmMedium, utmCampaign, utmContent } =
    raw;

  if (!ALLOWED_EVENTS.includes(event)) throw new ApiError(400, 'Evento no reconocido');
  if (!isValidUuid(visitorId)) throw new ApiError(400, 'visitorId inválido');
  if (!isValidUuid(sessionId)) throw new ApiError(400, 'sessionId inválido');

  const normalizedPropertyId = normalizePropertyId(propertyId);
  if (normalizedPropertyId === undefined) throw new ApiError(400, 'propertyId inválido');

  const normalizedPath = trimOrReject(path, MAX_LEN.path, 'path');
  if (!normalizedPath) throw new ApiError(400, 'path inválido');

  return {
    event,
    visitorId,
    sessionId,
    propertyId: normalizedPropertyId,
    path: normalizedPath,
    referrerHost: normalizeReferrerHost(trimOrReject(referrerHost, MAX_LEN.referrerHost, 'referrerHost')),
    utmSource: trimOrReject(utmSource, MAX_LEN.utm, 'utmSource'),
    utmMedium: trimOrReject(utmMedium, MAX_LEN.utm, 'utmMedium'),
    utmCampaign: trimOrReject(utmCampaign, MAX_LEN.utm, 'utmCampaign'),
    utmContent: trimOrReject(utmContent, MAX_LEN.utm, 'utmContent'),
  };
}

// Validación LAXA — usada por trackView/trackShare (rutas REST ya existentes que este
// cambio migra al nuevo esquema). Nunca lanza: un visitorId/sessionId ausente o inválido
// simplemente se guarda como null en vez de rechazar la petición, para no romper un bundle
// de cliente viejo en caché que todavía no manda estos campos. `path` se resuelve aparte
// (siempre a partir del propertyId de la ruta, no del body).
function sanitizeOptionalContext(raw) {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    visitorId: isValidUuid(body.visitorId) ? body.visitorId : null,
    sessionId: isValidUuid(body.sessionId) ? body.sessionId : null,
    referrerHost: normalizeReferrerHost(trimOrNull(body.referrerHost, MAX_LEN.referrerHost)),
    utmSource: trimOrNull(body.utmSource, MAX_LEN.utm),
    utmMedium: trimOrNull(body.utmMedium, MAX_LEN.utm),
    utmCampaign: trimOrNull(body.utmCampaign, MAX_LEN.utm),
    utmContent: trimOrNull(body.utmContent, MAX_LEN.utm),
  };
}

// Inserta el evento (con deduplicación y detección de bots) y, para property_view legítimas
// y frescas, incrementa el contador de conveniencia Property.views. Nunca lanza por datos de
// negocio inválidos (ej. un propertyId que ya no existe) — solo por errores de programación
// reales; el llamador puede tratar cualquier resultado como "ya quedó resuelto".
async function recordEvent({
  event,
  visitorId,
  sessionId,
  propertyId,
  path,
  referrerHost,
  utmSource,
  utmMedium,
  utmCampaign,
  utmContent,
  userAgent,
}) {
  const isBot = isBotUserAgent(userAgent);
  const { device, browser, os } = parseUserAgent(userAgent);

  if (DEDUP_EVENTS.has(event) && visitorId) {
    const recent = await Analytics.findOne({
      where: {
        event,
        visitorId,
        propertyId: propertyId ?? null,
        path,
        createdAt: { [Op.gte]: new Date(Date.now() - DEDUP_WINDOW_MS) },
      },
      attributes: ['id'],
    });
    if (recent) return { created: false, deduped: true, isBot };
  }

  try {
    await Analytics.create({
      event,
      visitorId,
      sessionId,
      propertyId,
      path,
      referrerHost,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      device,
      browser,
      os,
      isBot,
    });
  } catch (err) {
    // Un propertyId que ya no existe (borrado entre el render del cliente y el envío del
    // evento) es una carrera esperable, no un error de programación — se registra y se
    // sigue, nunca se le devuelve un 500 a un endpoint de analítica fire-and-forget.
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      logger.warn('analyticsService.recordEvent: propertyId inexistente, evento descartado', {
        event,
        propertyId,
      });
      return { created: false, deduped: false, isBot };
    }
    throw err;
  }

  if (event === 'property_view' && propertyId && !isBot) {
    await Property.increment('views', { where: { id: propertyId } });
  }

  return { created: true, deduped: false, isBot };
}

module.exports = {
  ALLOWED_EVENTS,
  isValidUuid,
  sanitizeEventInput,
  sanitizeOptionalContext,
  recordEvent,
};
