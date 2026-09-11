const { Op } = require('sequelize');
const { Lead } = require('../models/index');
const { normalizePhone } = require('./validators');

// Pedido del dueño del negocio: un mismo teléfono no puede repetirse entre prospectos. La
// comparación es por valor normalizado (normalizePhone), no por string exacto — el teléfono
// se guarda tal cual lo capturó quien lo creó (con o sin +52, con o sin separadores), así
// que "656-123-4567" y "6561234567" deben detectarse como el mismo número aunque el texto
// guardado sea distinto.
//
// DB-001: antes esto traía toda la tabla (`Lead.findAll` sin WHERE) y comparaba en
// JavaScript porque no había forma barata de normalizar en SQL las variantes de formato de
// `phone` — full-table-scan en la ruta más transitada del CRM, y una condición de carrera
// real (dos creaciones casi simultáneas del mismo teléfono podían pasar esta comprobación
// antes de que cualquiera hubiera insertado). Ahora `phoneNormalized` (columna mantenida
// por un hook del modelo, ver models/Lead.js) tiene un índice único: este lookup ya es
// directo/indexado, y el índice único de la base de datos es el respaldo real contra la
// condición de carrera — ver isDuplicatePhoneConstraintError de abajo, que traduce una
// violación de esa restricción al mismo caso de negocio que este chequeo.
//
// Compartido entre leadController (createLead/updateLead — rechaza el duplicado con 409) y
// exportController (createCatalogDownloadLead — reutiliza el prospecto existente en vez de
// rechazar, ver ese archivo). Única fuente de verdad: no reimplementar este lookup en otro
// lugar.
async function findDuplicatePhoneLead(phone, excludeId) {
  const target = normalizePhone(phone);
  if (!target) return null;

  return Lead.findOne({
    where: {
      phoneNormalized: target,
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
  });
}

// DB-001: `findDuplicatePhoneLead` de arriba es un check-then-insert — dos creaciones/
// ediciones casi simultáneas del mismo teléfono todavía podrían pasarlo ambas antes de que
// cualquiera commitee. El respaldo real contra esa carrera es el índice único de
// `phoneNormalized` en la base de datos (migración 20260901000000): si de todos modos
// ambas llegan a intentar el INSERT/UPDATE, MySQL rechaza a la segunda con ER_DUP_ENTRY.
// Esto traduce esa violación al mismo caso de negocio que ya usa el chequeo previo, en vez
// de dejar que se propague como un 500 crudo de Sequelize.
function isDuplicatePhoneConstraintError(error) {
  if (error?.name !== 'SequelizeUniqueConstraintError') return false;
  // Sequelize indexa `error.fields` por el NOMBRE DEL ÍNDICE de MySQL cuando lo puede leer
  // del mensaje de error del driver (no siempre por el nombre de columna) — verificado
  // directamente contra un ER_DUP_ENTRY real: `fields` viene como
  // `{ idx_leads_phone_normalized_unique: '...' }`, no `{ phoneNormalized: '...' }`.
  const fieldKeys = Object.keys(error.fields || {});
  return fieldKeys.includes('phoneNormalized') || fieldKeys.includes('idx_leads_phone_normalized_unique');
}

module.exports = { findDuplicatePhoneLead, isDuplicatePhoneConstraintError };
