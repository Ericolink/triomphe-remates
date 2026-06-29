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
