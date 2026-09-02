const { AuditLog } = require('../models/index');
const logger = require('./logger');

// Defensa en profundidad: ningún llamador actual pasa un secreto en `detail` (se revisó
// cada uno de los ~60 call sites), pero `logAudit` no tenía ninguna protección estructural
// si un caller futuro pasara `req.body` o una instancia de modelo completa tal cual. Se
// redacta recursivamente cualquier clave que coincida con este bloqueo antes de guardar.
const SENSITIVE_KEY_PATTERN = /password|token|secret|cookie|authorization|jwt/i;

function sanitizeDetail(value) {
  if (Array.isArray(value)) return value.map(sanitizeDetail);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeDetail(val),
      ])
    );
  }
  return value;
}

// action/resource/resourceId/detail: ver JSDoc de logAudit. result agrega si la acción
// tuvo éxito o falló — por defecto 'success' para no tocar ninguno de los ~60 call sites
// existentes, que siempre se llaman después de que la operación ya se completó.
const logAudit = (req, action, resource, resourceId = null, detail = null, result = 'success') => {
  AuditLog.create({
    userId: req.user?.id ?? null,
    userEmail: req.user?.email ?? null,
    userName: req.user?.name ?? null,
    action,
    resource,
    resourceId,
    detail: detail ? JSON.stringify(sanitizeDetail(detail)) : null,
    ip: req.ip ?? null,
    result,
  }).catch((e) => logger.error('Error en logAudit', { message: e.message, action, resource, resourceId }));
};

// Construye el detalle de "qué cambió" para un update, comparando el valor de cada campo
// ANTES de `.update()` contra su valor después.
//
// IMPORTANTE: `instance.previous(field)` de Sequelize NO sirve para esto pese a lo que
// sugiere su nombre — `_previousDataValues` se sobreescribe con los valores YA
// actualizados en cuanto `.update()`/`.save()` termina, así que llamarlo después (que es
// el único punto donde todos los call sites de este archivo ya invocan logAudit) siempre
// compara un valor contra sí mismo. Por eso este helper se usa en dos pasos: `snapshot()`
// ANTES de `instance.update(...)`, y `buildChanges(snapshot, instance)` después — mismo
// punto donde ya se llama a logAudit hoy, solo se agrega una línea antes del `.update()`.
function snapshotFields(instance, fields) {
  const snapshot = {};
  for (const field of fields) {
    if (field in instance.dataValues) snapshot[field] = instance.get(field);
  }
  return snapshot;
}

// Campos sin cambio real se omiten (evita ruido de "Etapa: Contacto → Contacto").
function buildChanges(snapshot, instance) {
  const changes = [];
  for (const field of Object.keys(snapshot)) {
    const before = snapshot[field];
    const after = instance.get(field);
    if (before === after) continue;
    if (before instanceof Date && after instanceof Date && before.getTime() === after.getTime()) continue;
    changes.push({ field, before: before ?? null, after: after ?? null });
  }
  return changes;
}

module.exports = { logAudit, snapshotFields, buildChanges, sanitizeDetail };
