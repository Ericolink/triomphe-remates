export const WHATSAPP_NUMBER = '526565792750';

// Convierte un mapa de labels (CITY_LABELS, TYPE_LABELS, etc.) en opciones para <select>,
// preservando el orden de inserción y excluyendo claves que no aplican como filtro.
export const labelsToOptions = (labels, exclude = []) =>
  Object.entries(labels).filter(([value]) => !exclude.includes(value)).map(([value, label]) => ({ value, label }));

export const CITY_LABELS = {
  juarez: 'Cd. Juárez',
  chihuahua: 'Chihuahua',
  queretaro: 'Querétaro',
  otra: 'Otra',
};

export const TYPE_LABELS = {
  casa: 'Casa',
  departamento: 'Departamento',
  terreno: 'Terreno',
  local: 'Local',
  bodega: 'Bodega',
};

// Versión abreviada para tablas admin con espacio reducido
export const TYPE_LABELS_SHORT = {
  casa: 'Casa',
  departamento: 'Depto.',
  terreno: 'Terreno',
  local: 'Local',
  bodega: 'Bodega',
};

export const STATUS_LABELS = {
  disponible: 'Disponible',
  apartado: 'Apartado',
  vendido: 'Vendido',
};

export const STATUS_VARIANTS = {
  disponible: 'success',
  apartado: 'warning',
  vendido: 'danger',
};

// AUDIT-012: estaba duplicado idénticamente en LeadsPage.jsx y CalendarPage.jsx
export const LEAD_TYPE_LABELS = {
  contacto: 'Contacto',
  cita: 'Cita',
  informacion: 'Información',
};

export const SOURCE_LABELS = {
  google:    'Google',
  facebook:  'Facebook',
  whatsapp:  'WhatsApp',
  directo:   'Directo',
  referido:  'Referido',
  otro:      'Otro',
};

export const SOURCE_COLORS = {
  google:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  facebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  directo:  'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300',
  referido: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  otro:     'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

// CRM Comercial — embudo de 8 etapas (reemplaza el status de 4 valores en la UI; el
// backend sigue escribiendo `status` en paralelo por compatibilidad, ver
// server/src/utils/pipelineHelpers.js legacyStatusFor).
export const PIPELINE_STAGE_LABELS = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  cita_agendada: 'Cita agendada',
  cita_realizada: 'Cita realizada',
  negociacion: 'Negociación',
  venta_realizada: 'Venta realizada',
  no_interesado: 'No interesado',
};

// Mapeadas a las 5 variantes que soporta Badge (default/success/warning/danger/primary)
export const PIPELINE_STAGE_VARIANTS = {
  nuevo: 'primary',
  contactado: 'warning',
  interesado: 'warning',
  cita_agendada: 'primary',
  cita_realizada: 'primary',
  negociacion: 'warning',
  venta_realizada: 'success',
  no_interesado: 'default',
};

export const TERMINAL_STAGES = ['venta_realizada', 'no_interesado'];

export const CLOSE_REASON_LABELS = {
  compro: 'Compró',
  no_respondio: 'No respondió',
  sin_presupuesto: 'Sin presupuesto',
  compro_competencia: 'Compró con otra inmobiliaria',
  solo_info: 'Solo solicitó información',
  perdio_interes: 'Perdió interés',
  otro: 'Otro',
};

export const ACTIVITY_TYPE_LABELS = {
  llamada: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  visita: 'Visita',
  nota: 'Nota',
  sistema: 'Sistema',
};

export const ACTIVITY_TYPE_COLORS = {
  llamada:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  email:    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  visita:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  nota:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  sistema:  'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400',
};

export const APPOINTMENT_STATUS_LABELS = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  completada: 'Completada',
  no_show: 'No asistió',
  cancelada: 'Cancelada',
};

export const APPOINTMENT_STATUS_VARIANTS = {
  programada: 'primary',
  confirmada: 'primary',
  completada: 'success',
  no_show: 'danger',
  cancelada: 'default',
};

// Task.type es un STRING libre en el backend (no un ENUM estricto) — estas son solo las
// etiquetas "bonitas" para los tipos más comunes; cualquier otro valor se muestra tal cual.
export const TASK_TYPE_LABELS = {
  llamar: 'Llamar',
  dar_seguimiento: 'Dar seguimiento',
  confirmar_cita: 'Confirmar cita',
  enviar_info: 'Enviar información',
  esperar_documentacion: 'Esperar documentación',
  otro: 'Otro',
};

export const CAMPAIGN_PLATFORM_LABELS = {
  facebook: 'Facebook',
  google: 'Google',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  otro: 'Otro',
};
