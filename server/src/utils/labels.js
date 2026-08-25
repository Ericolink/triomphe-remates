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
  en_revision: 'En revisión',
  apartado: 'Apartado',
  vendido: 'Vendido',
  de_vuelta: 'De vuelta',
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

// Tipo de proceso legal de adquisición (Property.legalProcessType) — debe coincidir con
// LEGAL_PROCESS_TYPE_LABELS en client/src/utils/constants.js. Usado por el export de Excel.
const LEGAL_PROCESS_TYPE_LABEL = {
  cesion: 'Cesión',
  dacion: 'Dación',
  adjudicacion: 'Adjudicación',
};

module.exports = {
  CITY_LABEL,
  PROPERTY_TYPE_LABEL,
  STATUS_LABEL,
  LEAD_TYPE_LABEL,
  LEGAL_PROCESS_TYPE_LABEL,
};
