export const WHATSAPP_NUMBER = '526565792750';

// Oficinas físicas de Triomphe — fuente única de verdad para Footer.jsx y ContactPage.jsx
// (antes vivía solo en Footer.jsx). TODO: reemplazar los datos de Chihuahua con la
// información real de la oficina.
export const OFFICES = [
  {
    city: 'Ciudad Juárez',
    cityLabel: 'Cd. Juárez, Chih.',
    phone: '+52 (656) 579-2750',
    email: 't.bienesraicesmx@gmail.com',
    street: 'Av. Paseo Triunfo de la República 215-INT 24',
    location: 'San Lorenzo, 32320 Juárez, Chih.',
  },
  {
    city: 'Chihuahua',
    cityLabel: 'Chihuahua, Chih.',
    phone: 'Próximamente',
    email: 'Próximamente',
    street: 'Próximamente',
    location: 'Chihuahua, Chih.',
  },
];

// Convierte un mapa de labels (CITY_LABELS, TYPE_LABELS, etc.) en opciones para <select>,
// preservando el orden de inserción y excluyendo claves que no aplican como filtro.
export const labelsToOptions = (labels, exclude = []) =>
  Object.entries(labels)
    .filter(([value]) => !exclude.includes(value))
    .map(([value, label]) => ({ value, label }));

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

// Categoría comercial de la propiedad — distinta del `status` (disponible/apartado/vendido) y
// de `businessLine` (ver más abajo). Las claves internas (compra_venta_credito/
// compra_venta_contado) se conservan tal cual desde la migración 20260723000001; solo el texto
// visible se actualiza acá. `compra_venta_contado` ya NO se llama "Infonavit" — esa semántica
// vive ahora en el campo `businessLine` (migración 20260731000000), que separa por completo la
// sección pública de remates de la de Infonavit; tener las dos palabras "Infonavit" con
// significados distintos en la misma UI sería confuso.
export const CATEGORY_LABELS = {
  remate: 'Remates',
  renta: 'Renta',
  compra_venta_credito: 'Compra venta remates',
  compra_venta_contado: 'Compra venta de contado',
};

// Mapeadas a las 5 variantes que soporta Badge, mismo criterio que STATUS_VARIANTS
export const CATEGORY_VARIANTS = {
  remate: 'primary',
  renta: 'warning',
  compra_venta_credito: 'success',
  compra_venta_contado: 'success',
};

// Línea de negocio de la propiedad — el eje que separa por completo las dos secciones
// públicas del sitio (remates bancarios para inversionistas vs. Infonavit para compradores
// de vivienda). Independiente de `category` (que es una subclasificación dentro de la línea
// de remates). Ver migración 20260731000000-add-businessline-to-properties.
export const BUSINESS_LINE_LABELS = {
  remate: 'Remate Bancario',
  infonavit: 'Infonavit',
};

export const BUSINESS_LINE_VARIANTS = {
  remate: 'primary',
  infonavit: 'success',
};

// Fuente única de copy por línea de negocio. Ambas conviven en el mismo módulo
// /propiedades (selector de tabs, ver TabBar en PropertiesPage) — no hay landing ni ruta
// separada por línea, así que solo `remate` usa los campos de hero/CTA/SEO (el home sigue
// enfocado exclusivamente en remates). El resto de los campos (listingTitle/listingDescription/
// priceLabel/keywordsPrefix/descriptionSuffix) los leen ambas líneas: PropertiesPage para el
// H1/SEO que cambia al alternar de tab, y PropertyDetailPage/SEO/PropertyCard para mostrar la
// propiedad correctamente sin importar desde qué tab se llegó. Agregar una tercera línea en el
// futuro (renta, preventa...) es sumar una entrada acá + el valor al ENUM `businessLine`.
export const BUSINESS_LINE_CONTENT = {
  remate: {
    heroBadge: 'Precios del 30% al 70% por debajo del mercado.',
    heroTitle: 'Remates Bancarios',
    heroTitleAccent: 'en México',
    heroSubtitle:
      'Encuentra propiedades a precios de remate en Chihuahua, Ciudad Juárez y Querétaro. Has llegado al lugar correcto para hacer crecer tus inversiones, con más de 28 años de experiencia a nivel nacional.',
    ctaText: '¿Te interesa alguna propiedad o inversión?',
    listingPath: '/propiedades',
    listingTitle: 'Propiedades en Remate',
    listingDescription: 'Explora nuestro inventario de remates bancarios.',
    seoTitle: 'Remates Bancarios en México',
    seoDescription:
      'Encuentra propiedades en remate bancario en Chihuahua, Ciudad Juárez y Querétaro. Casas, departamentos y terrenos del 30% al 70% por debajo del valor comercial.',
    priceLabel: 'Precio de remate',
    keywordsPrefix: 'remate bancario',
    descriptionSuffix: 'en remate bancario',
  },
  infonavit: {
    listingPath: '/propiedades',
    listingTitle: 'Casas Infonavit',
    listingDescription: 'Encuentra tu próxima vivienda con crédito Infonavit o hipotecario.',
    priceLabel: 'Precio',
    keywordsPrefix: 'infonavit, crédito hipotecario',
    descriptionSuffix: 'con crédito Infonavit',
  },
};

// Fondo del <select> de estatus en la tabla admin (AdminPropertiesPage) — no puede ser un
// <Badge> porque es el control de formulario mismo, pero usa la misma familia -300 en dark
// que Badge para que se vea como el mismo estado en todas partes.
export const STATUS_SELECT_COLORS = {
  disponible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  apartado: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  vendido: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

// Punto de color del historial de cambios de estatus (PropertyFormPage)
export const STATUS_DOT_COLORS = {
  disponible: 'bg-green-500',
  apartado: 'bg-yellow-500',
  vendido: 'bg-red-500',
};

// Tarjetas "Estatus del inventario" del Dashboard — mismo criterio que
// PIPELINE_STAGE_BAR_COLORS: encoding visual distinto (tile vs. badge), por eso no comparte
// clases con STATUS_VARIANTS, pero es una sola fuente para las 3 tarjetas.
export const STATUS_STAT_COLORS = {
  disponible: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-300',
  apartado: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300',
  vendido: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300',
};

// Etapa del trámite legal de adquisición del inmueble — estaba duplicado entre
// PropertyFormPage.jsx y PropertyDetailPage.jsx (este último sin 'sin_proceso', que es
// un valor interno de formulario y no tiene sentido mostrar en la barra de progreso pública).
export const ACQUISITION_STAGE_LABELS = {
  sin_proceso: 'Sin proceso',
  documentacion: 'Documentación',
  avaluo: 'Avalúo',
  negociacion: 'Negociación',
  firma: 'Firma',
  entrega: 'Entrega',
};

// AUDIT-012: estaba duplicado idénticamente en LeadsPage.jsx y CalendarPage.jsx.
// Motivos de contacto del formulario público "Contactar asesor" — 'contacto' y 'cita'
// conservan sus claves porque siguen disparando lógica (defaultValue del modelo Lead y
// la UI/flujo de agendar cita respectivamente, ver ContactForm.jsx y leadController.js).
// 'informacion' y 'propiedades_similares' ya no son motivos seleccionables en formularios
// nuevos — se conservan aquí solo para mostrar correctamente el motivo de leads históricos
// que ya los tenían guardados (ver labelsToOptions(..., ['informacion', 'propiedades_similares'])
// en ContactForm.jsx).
export const LEAD_TYPE_LABELS = {
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

export const SOURCE_LABELS = {
  google: 'Google',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  directo: 'Directo',
  referido: 'Referido',
  otro: 'Otro',
};

export const SOURCE_COLORS = {
  google: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  facebook: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  directo: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300',
  referido: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  otro: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
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

// Color de barra por etapa en los reportes (ReportsSection del Dashboard) — a diferencia de
// PIPELINE_STAGE_VARIANTS (que agrupa varias etapas bajo el mismo estado de Badge), aquí
// cada etapa necesita un color distinto para poder distinguirse en la misma gráfica. Las
// dos etapas terminales sí reutilizan el verde/gris ya establecido en Badge/Kanban para
// "venta"/"perdido"; el resto sigue un orden categórico fijo, nunca por posición en el
// arreglo (evita que los colores cambien si una fila se filtra por tener total 0). Orden
// validado con el script de accesibilidad de la skill dataviz (separación ante daltonismo
// y contraste normal) contra ambos fondos — solo el gris "sin datos" queda fuera del piso
// de croma a propósito (siempre va acompañado de su etiqueta de texto visible).
export const PIPELINE_STAGE_BAR_COLORS = {
  nuevo: 'bg-blue-600 dark:bg-blue-500',
  contactado: 'bg-teal-600 dark:bg-teal-400',
  interesado: 'bg-orange-600 dark:bg-orange-400',
  cita_agendada: 'bg-pink-600 dark:bg-pink-400',
  cita_realizada: 'bg-amber-600 dark:bg-amber-400',
  negociacion: 'bg-violet-600 dark:bg-violet-400',
  venta_realizada: 'bg-green-600 dark:bg-green-400',
  no_interesado: 'bg-gray-400 dark:bg-gray-500',
};

export const CLOSE_REASON_LABELS = {
  compro: 'Compró',
  no_respondio: 'No respondió',
  sin_presupuesto: 'Sin presupuesto',
  compro_competencia: 'Compró con otra inmobiliaria',
  solo_info: 'Solo solicitó información',
  perdio_interes: 'Perdió interés',
  otro: 'Otro',
};

// Mismo criterio de orden categórico fijo que PIPELINE_STAGE_BAR_COLORS, validado aparte
// (7 categorías, orden de adyacencia propio de esta lista).
export const CLOSE_REASON_BAR_COLORS = {
  compro: 'bg-pink-600 dark:bg-pink-400',
  no_respondio: 'bg-amber-600 dark:bg-amber-400',
  sin_presupuesto: 'bg-blue-600 dark:bg-blue-500',
  compro_competencia: 'bg-teal-600 dark:bg-teal-400',
  solo_info: 'bg-violet-600 dark:bg-violet-400',
  perdio_interes: 'bg-orange-600 dark:bg-orange-400',
  otro: 'bg-gray-400 dark:bg-gray-500',
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
  llamada: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  whatsapp: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  email: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  visita: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  nota: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  sistema: 'bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400',
};

export const APPOINTMENT_STATUS_LABELS = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  completada: 'Completada',
  no_show: 'No asistió',
  cancelada: 'Cancelada',
};

// completada/no_show/cancelada se mantienen en la familia verde/rojo/gris de
// APPOINTMENT_STATUS_VARIANTS (emerald/red en vez de green/red puros: el par
// verde-rojo puro no separa lo suficiente para daltonismo rojo-verde al quedar
// adyacentes en esta lista — validado con el script de la skill dataviz).
// programada/confirmada comparten variant "primary" en el Badge pero aquí necesitan
// distinguirse, así que se separan en cian/azul.
export const APPOINTMENT_STATUS_BAR_COLORS = {
  programada: 'bg-cyan-600 dark:bg-cyan-400',
  confirmada: 'bg-blue-600 dark:bg-blue-500',
  completada: 'bg-emerald-600 dark:bg-emerald-400',
  no_show: 'bg-red-600 dark:bg-red-400',
  cancelada: 'bg-gray-400 dark:bg-gray-500',
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

export const PAYMENT_METHOD_LABELS = {
  credito_hipotecario: 'Crédito hipotecario',
  contado: 'Contado',
};

export const FEEDBACK_CATEGORY_LABELS = {
  queja: 'Queja',
  comentario: 'Comentario',
  sugerencia: 'Sugerencia',
};

// Mapeadas a las 5 variantes que soporta Badge, mismo criterio que PIPELINE_STAGE_VARIANTS
export const FEEDBACK_CATEGORY_VARIANTS = {
  queja: 'danger',
  comentario: 'primary',
  sugerencia: 'success',
};

// Franja de degradado del lado derecho de la tarjeta (BuzonAdminPage) — opacidad baja para
// que el contenido siga siendo legible encima; el Badge de categoría es opaco así que no
// se ve afectado por estar sobre la franja.
export const FEEDBACK_CATEGORY_GRADIENT = {
  queja: 'from-red-400/50 dark:from-red-500/25',
  comentario: 'from-blue-400/50 dark:from-blue-500/25',
  sugerencia: 'from-green-400/50 dark:from-green-500/25',
};

export const FEEDBACK_STATUS_LABELS = { nuevo: 'Nuevo', leido: 'Leído', archivado: 'Archivado' };

// AUDIT: estaba duplicado idénticamente en JobsAdminPage.jsx y JobsPage.jsx
export const JOB_TYPE_LABELS = {
  tiempo_completo: 'Tiempo completo',
  medio_tiempo: 'Medio tiempo',
  por_comision: 'Por comisión',
};

export const JOB_STATUS_LABELS = {
  activa: 'Activa',
  pausada: 'Pausada',
  cerrada: 'Cerrada',
};

// Raw classes en vez de variantes de Badge: el pill de JobsAdminPage combina este color con
// el de "urgente" (que lo pisa), algo que la API simple de Badge no soporta.
export const JOB_STATUS_COLORS = {
  activa: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  pausada: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  cerrada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export const TESTIMONIAL_STATUS_LABELS = {
  pendiente: 'Pendiente',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

export const TESTIMONIAL_STATUS_VARIANTS = {
  pendiente: 'warning',
  publicado: 'success',
  archivado: 'default',
};

export const CAMPAIGN_PLATFORM_LABELS = {
  facebook: 'Facebook',
  google: 'Google',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  otro: 'Otro',
};
