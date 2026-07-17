// AUDIT-012: fuente única de verdad para labels de dominio en el backend — antes
// cityLabel/typeLabel/statusLabel se redefinían de forma independiente en emailService.js,
// whatsappService.js y exportController.js (con texto ligeramente distinto entre copias),
// con riesgo real de desincronización al agregar una ciudad/tipo nuevo. Los valores deben
// coincidir con client/src/utils/constants.js (CITY_LABELS/TYPE_LABELS/STATUS_LABELS) — si
// se agrega una ciudad o tipo, actualizar ambos lados.
const CITY_LABEL = {
  juarez: 'Cd. Juárez',
  chihuahua: 'Chihuahua',
  queretaro: 'Querétaro',
  otra: 'Otra',
};

const PROPERTY_TYPE_LABEL = {
  casa: 'Casa',
  departamento: 'Departamento',
  terreno: 'Terreno',
  local: 'Local',
  bodega: 'Bodega',
};

const STATUS_LABEL = {
  disponible: 'Disponible',
  apartado: 'Apartado',
  vendido: 'Vendido',
};

module.exports = { CITY_LABEL, PROPERTY_TYPE_LABEL, STATUS_LABEL };
