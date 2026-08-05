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

// Motivos de contacto de un Lead — debe coincidir con LEAD_TYPE_LABELS en
// client/src/utils/constants.js. Antes estaba duplicado de forma independiente en
// exportController.js y emailService.js (con texto ligeramente distinto entre copias).
const LEAD_TYPE_LABEL = {
  comprar_propiedad: 'Quiero comprar una propiedad',
  rentar_propiedad: 'Quiero rentar una propiedad',
  vender_propiedad: 'Quiero vender una propiedad',
  invertir_remates: 'Quiero invertir en remates bancarios',
  contacto: 'Solicitar información de una propiedad',
  cita: 'Agendar una cita con un asesor',
  asesoria_financiera: 'Solicitar asesoría inmobiliaria',
  otro: 'Otro',
  informacion: 'Información del remate',
  propiedades_similares: 'Conocer propiedades similares',
};

// Estado de la República al que pertenece cada ciudad — usado por la ficha técnica PDF
// para el bloque de ubicación (Estado → Ciudad → Fraccionamiento → Colonia → Calle).
// Property.city no tiene 'otra' en su ENUM real (ver models/Property.js), así que no
// hace falta un valor por defecto.
const CITY_STATE_LABEL = {
  juarez: 'Chihuahua',
  chihuahua: 'Chihuahua',
  queretaro: 'Querétaro',
};

module.exports = {
  CITY_LABEL,
  PROPERTY_TYPE_LABEL,
  STATUS_LABEL,
  CITY_STATE_LABEL,
  LEAD_TYPE_LABEL,
};
