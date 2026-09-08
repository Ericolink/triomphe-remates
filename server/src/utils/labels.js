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
  escritura: 'Escritura',
};

// Línea de negocio (Property/Lead/PropertyAlert.businessLine) — debe coincidir con
// BUSINESS_LINE_LABELS en client/src/utils/constants.js. Usado por el export de Excel/PDF de
// la lista de espera (exportController.js).
const BUSINESS_LINE_LABEL = {
  remate: 'Remates Bancarios',
  credito: 'Con Crédito',
  renta: 'En Renta',
  contado: 'De Contado',
  inversion: 'Inversiones',
};

// Urgencia/tiempo estimado de un Lead (rediseño CRM) — debe coincidir con
// LEAD_URGENCY_LABELS en client/src/utils/constants.js. Usado por el export de Excel de leads.
const LEAD_URGENCY_LABEL = {
  inmediata: 'Inmediata',
  '1_3_meses': '1 a 3 meses',
  '3_6_meses': '3 a 6 meses',
  mas_6_meses: 'Más de 6 meses',
};

// Etapa del pipeline CRM (Lead.pipelineStage) — debe coincidir con PIPELINE_STAGE_LABELS en
// client/src/utils/constants.js. Usado por el export de Excel de leads (columna "Estado").
const PIPELINE_STAGE_LABEL = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  negociacion: 'Negociación/información',
  cita_agendada: 'Cita agendada',
  cita_realizada: 'Cita realizada',
  cita_con_seguimiento: 'Cita con seguimiento',
  venta_realizada: 'Venta realizada',
  no_interesado: 'No interesado',
  lista_espera: 'Lista de espera',
};

// Motivo de cierre de un Lead (Lead.closeReason) — debe coincidir con CLOSE_REASON_LABELS en
// client/src/utils/constants.js. Usado por el export de Excel de leads (columna "Motivo").
const CLOSE_REASON_LABEL = {
  compro: 'Compró',
  no_respondio: 'No respondió',
  sin_presupuesto: 'Sin presupuesto',
  compro_competencia: 'Compró con otra inmobiliaria',
  solo_info: 'Solo solicitó información',
  perdio_interes: 'Perdió interés',
  otro: 'Otro',
};

module.exports = {
  CITY_LABEL,
  PROPERTY_TYPE_LABEL,
  STATUS_LABEL,
  LEAD_TYPE_LABEL,
  LEGAL_PROCESS_TYPE_LABEL,
  BUSINESS_LINE_LABEL,
  LEAD_URGENCY_LABEL,
  PIPELINE_STAGE_LABEL,
  CLOSE_REASON_LABEL,
};
