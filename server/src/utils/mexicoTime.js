// Ancla horaria para todo cálculo de "día"/"semana"/rango en los dashboards de analítica
// (ver AUDITORIA de la Fase 1 — hallazgo de timezone). Antes de este archivo, "Hoy"/"últimos
// N días" se calculaban con `new Date().setHours(0,0,0,0)`, que usa la zona horaria LOCAL
// DEL PROCESO DE NODE — una variable no controlada en producción (SmarterASP/IIS, `TZ` sin
// fijar) que puede no coincidir en absoluto con la hora de México. Y el bucketing por día del
// lado de MySQL (`DATE(createdAt)`) siempre agrupa en UTC (la conexión usa
// `@@session.time_zone = '+00:00'`), que TAMPOCO es la hora de México. Dos sistemas, dos
// zonas horarias distintas, ninguna de las dos es la correcta.
//
// La solución: nunca depender de la zona horaria del proceso ni de MySQL — todo el cálculo
// de "qué día/semana es esto en México" se hace aquí con aritmética UTC explícita, usando un
// offset fijo como ancla única para todo el negocio.
//
// Triomphe opera en Chihuahua/Juárez/Querétaro. Juárez sigue horario de verano de EE. UU.
// por ley desde 2022 (border zone); el resto del país lo abolió ese mismo año. No existe un
// único huso 100% correcto para las 3 ciudades a la vez — se usa -06:00 (Zona Centro, sin
// horario de verano) como ancla única para todo el dashboard, una simplificación deliberada:
// preferible a que cada ciudad tenga su propio corte de "día" en el mismo reporte.
//
// Contrato de las funciones de abajo, para no volver a mezclar "instante real" con "clave de
// calendario ya calculada" (la fuente del bug original):
//   - mexicoMidnightUtc / mexicoMidnightUtcFromParts devuelven un INSTANTE UTC real — para
//     usar como límite de una query (`createdAt >= X`).
//   - mexicoDateKey / mexicoWeekStartKey reciben un instante UTC real y devuelven una CLAVE
//     'YYYY-MM-DD' (el día/lunes-de-la-semana en México).
//   - formatDateKeyLabel recibe una CLAVE ya calculada (no un instante) y solo la da formato
//     — nunca vuelve a aplicar el offset, porque la clave ya es un día de calendario, no un
//     instante que deba desplazarse.
const MEXICO_UTC_OFFSET_HOURS = -6;
const MEXICO_OFFSET_MS = MEXICO_UTC_OFFSET_HOURS * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Medianoche en México (00:00 hora Centro), N días desde hoy, expresada como el instante
// UTC correspondiente.
function mexicoMidnightUtc(daysFromToday = 0) {
  const nowMexicoWallClock = new Date(Date.now() + MEXICO_OFFSET_MS);
  const y = nowMexicoWallClock.getUTCFullYear();
  const m = nowMexicoWallClock.getUTCMonth();
  const d = nowMexicoWallClock.getUTCDate() + daysFromToday;
  return new Date(Date.UTC(y, m, d) - MEXICO_OFFSET_MS);
}

// Medianoche en México del día calendario Y-M-D indicado (mes 1-12), como instante UTC —
// para rangos personalizados (?from=2026-01-15&to=...), donde esas fechas son días de
// calendario en hora de México, no UTC.
function mexicoMidnightUtcFromParts(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day) - MEXICO_OFFSET_MS);
}

// Clave 'YYYY-MM-DD' del día calendario en México al que pertenece un instante UTC real.
function mexicoDateKey(instant) {
  const shifted = new Date(instant.getTime() + MEXICO_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

// Clave 'YYYY-MM-DD' del lunes de la semana (en México) a la que pertenece un instante UTC
// real — mismo criterio de "semana empieza en lunes" que ya usaba este dashboard.
function mexicoWeekStartKey(instant) {
  const shifted = new Date(instant.getTime() + MEXICO_OFFSET_MS);
  const day = shifted.getUTCDay(); // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(shifted);
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);
  return monday.toISOString().slice(0, 10);
}

// Etiqueta corta ("03 ago") a partir de una clave 'YYYY-MM-DD' YA calculada (mexicoDateKey/
// mexicoWeekStartKey) — se formatea con timeZone: 'UTC' a propósito: la clave representa un
// día de calendario, no un instante, así que forzar el formateador a leerla como UTC evita
// que la vuelva a desplazar con la zona horaria del proceso.
function formatDateKeyLabel(key) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

module.exports = {
  MEXICO_UTC_OFFSET_HOURS,
  DAY_MS,
  mexicoMidnightUtc,
  mexicoMidnightUtcFromParts,
  mexicoDateKey,
  mexicoWeekStartKey,
  formatDateKeyLabel,
};
