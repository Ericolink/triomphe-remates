// Fase 1 de analítica de tráfico propia. Único punto donde el frontend sabe cómo se ve un
// evento y cómo se manda — ningún componente reimplementa esta lógica (ver
// AUDITORIA/análisis de analítica). Todo aquí está pensado para NUNCA romper la navegación:
// cada función pública atrapa sus propios errores y no devuelve una promesa que alguien
// tenga que esperar.

export const ANALYTICS_EVENTS = {
  PAGE_VIEW: 'page_view',
  PROPERTY_VIEW: 'property_view',
  PROPERTY_SHARE: 'property_share',
  WHATSAPP_CLICK: 'whatsapp_click',
  EMAIL_CLICK: 'email_click',
  TECHNICAL_SHEET_DOWNLOAD: 'technical_sheet_download',
};

const VISITOR_KEY = 'triomphe_visitor_id';
const SESSION_KEY = 'triomphe_session';
const SESSION_INACTIVITY_MS = 30 * 60 * 1000; // 30 minutos

// crypto.randomUUID() cubre todo navegador moderno; el fallback solo importa para no romper
// en el resto (no necesita ser criptográficamente fuerte, es un identificador anónimo, no un
// secreto).
function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// UUID anónimo y persistente del visitante — nunca contiene nombre/email/teléfono ni
// ningún dato personal, solo sirve para aproximar "visitante único" y "nuevo vs. recurrente".
export function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = generateUuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // localStorage bloqueado (modo privado estricto, storage lleno, etc.) — se genera un id
    // efímero para esta carga de página en vez de romper el tracking por completo.
    return generateUuid();
  }
}

// La SPA nunca vuelve a pedir la página al servidor tras el primer load, así que
// document.referrer y los utm_* de la URL solo tienen un valor real de "de dónde vino la
// persona" en ese primer load — se capturan UNA vez por sesión y se reutilizan en todos los
// eventos posteriores (ver PASO 9 del brief: "si la sesión comenzó con UTM, conservar esa
// atribución durante la sesión").
function captureAttribution() {
  let referrerHost;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : null;
  } catch {
    referrerHost = null;
  }
  const params = new URLSearchParams(window.location.search);
  return {
    referrerHost,
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent: params.get('utm_content') || undefined,
  };
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Sin storage disponible, la sesión simplemente no persiste entre llamadas — cada
    // evento cae al fallback en memoria de getSessionContext, nunca revienta.
  }
}

let memorySession = null;

// Sesión anónima: se rota tras 30 min de inactividad. Devuelve { id, referrerHost, utm* } —
// la MISMA atribución capturada al iniciar la sesión, sin importar cuántas rutas después se
// visiten. Actualiza `lastActivity` en cada llamada.
export function getSessionContext() {
  const now = Date.now();
  let session = readStoredSession() || memorySession;

  const expired = !session || now - session.lastActivity > SESSION_INACTIVITY_MS;
  if (expired) {
    session = { id: generateUuid(), lastActivity: now, ...captureAttribution() };
  } else {
    session = { ...session, lastActivity: now };
  }

  memorySession = session;
  writeStoredSession(session);
  return session;
}

// Envía un evento sin bloquear ni retrasar nada. Orden de intento: sendBeacon (fire-and-
// forget real, sobrevive a un cambio de página) y, si no está disponible, fetch con
// keepalive. Nunca lanza — un fallo de red o de Analytics jamás debe verse en la UI.
function sendPayload(payload) {
  const body = JSON.stringify(payload);
  const url = `${import.meta.env.VITE_API_URL || ''}/analytics/events`;

  try {
    if (navigator.sendBeacon) {
      // text/plain (no application/json): un POST cross-origin con sendBeacon no puede
      // llevar un Content-Type fuera de la lista "simple" del navegador sin disparar un
      // preflight que sendBeacon no soporta — ver server/src/routes/analytics.js.
      const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
  } catch {
    // sigue al fallback de abajo
  }

  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics caído/bloqueado — la navegación continúa exactamente igual.
  }
}

// Punto de entrada único para instrumentar cualquier interacción. `path` por defecto es la
// ruta actual; `propertyId`/`meta` son opcionales.
export function trackEvent(event, { path, propertyId } = {}) {
  try {
    const session = getSessionContext();
    sendPayload({
      event,
      visitorId: getVisitorId(),
      sessionId: session.id,
      propertyId: propertyId ?? null,
      path: path || window.location.pathname,
      referrerHost: session.referrerHost,
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign,
      utmContent: session.utmContent,
    });
  } catch {
    // Cualquier error inesperado (localStorage, JSON, lo que sea) se descarta en silencio —
    // ver PASO de rendimiento: Analytics nunca debe generar un error visible al usuario.
  }
}

// Contexto opcional para adjuntar a POST /properties/:id/view y /:id/share (endpoints REST
// ya existentes, migrados al mismo esquema) — mismos campos que trackEvent, sin volver a
// pedirle a cada caller que arme el objeto a mano.
export function getAnalyticsRequestContext() {
  try {
    const session = getSessionContext();
    return {
      visitorId: getVisitorId(),
      sessionId: session.id,
      referrerHost: session.referrerHost,
      utmSource: session.utmSource,
      utmMedium: session.utmMedium,
      utmCampaign: session.utmCampaign,
      utmContent: session.utmContent,
    };
  } catch {
    return {};
  }
}
