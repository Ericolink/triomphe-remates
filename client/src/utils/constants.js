export const WHATSAPP_NUMBER = '526565792750';

// Oficinas físicas de Triomphe — fuente única de verdad para Footer.jsx y ContactPage.jsx
// (antes vivía solo en Footer.jsx). TODO: reemplazar el email de Chihuahua con el real
// de esa oficina (dirección y teléfono ya son los definitivos).
export const OFFICES = [
  {
    city: 'Ciudad Juárez',
    cityLabel: 'Cd. Juárez, Chih.',
    phone: '+52 (656) 579-2750',
    email: 't.bienesraicesmx@gmail.com',
    street: 'Av. Paseo Triunfo de la República 215-INT 24',
    location: 'San Lorenzo, 32320 Juárez, Chih.',
    mapsUrl: 'https://maps.app.goo.gl/iRTMK1476tSHDiw36',
  },
  {
    city: 'Chihuahua',
    cityLabel: 'Chihuahua, Chih.',
    phone: '+52 (614) 477-9231',
    email: 't.bienesraicesmx@gmail.com',
    street: 'C. Alabama 2400',
    location: 'Quintas del Sol, Campestre-Lomas, 31214 Chihuahua, Chih.',
    mapsUrl: 'https://maps.app.goo.gl/Cq64eJ4sxtLvTwAW9',
  },
];

// Convierte un mapa de labels (CITY_LABELS, TYPE_LABELS, etc.) en opciones para <select>,
// preservando el orden de inserción y excluyendo claves que no aplican como filtro.
export const labelsToOptions = (labels, exclude = []) =>
  Object.entries(labels)
    .filter(([value]) => !exclude.includes(value))
    .map(([value, label]) => ({ value, label }));

export const ROLE_LABELS = {
  admin: 'Admin',
  coordinador_ventas: 'Coordinador de Ventas',
  asesor_ventas: 'Asesor',
  asistente_administrativo: 'Asistente Administrativo',
};

export const ROLE_COLORS = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  coordinador_ventas: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  asesor_ventas: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  asistente_administrativo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

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
  en_revision: 'En revisión',
  apartado: 'Apartado',
  vendido: 'Vendido',
  de_vuelta: 'De vuelta',
};

// Mapeadas a las 5 variantes que soporta Badge (default/success/warning/danger/primary) —
// `apartado` pasó de warning a primary (dorado) cuando se agregó `en_revision`, que le
// tomó el amarillo por ser el estado que efectivamente significa "en revisión".
export const STATUS_VARIANTS = {
  disponible: 'success',
  en_revision: 'warning',
  apartado: 'primary',
  vendido: 'danger',
  de_vuelta: 'default',
};

// Categoría comercial de la propiedad — distinta del `status` (disponible/apartado/vendido) y
// de `businessLine` (ver más abajo). `compra_venta_credito`/`compra_venta_contado` (distinción
// de forma de pago) se fusionaron en un solo valor `compra_venta` — ver migración
// 20260813000006-consolidate-property-category.
export const CATEGORY_LABELS = {
  remate: 'Remates',
  renta: 'Renta',
  compra_venta: 'Compra-Venta',
};

// Tipo de proceso legal de adquisición (Property.legalProcessType) — campo de seguimiento de
// inventario alineado con la hoja maestra de Excel del negocio (columna COFINAVIT/VIABILIDAD/
// TIPO). Debe coincidir con LEGAL_PROCESS_TYPE_LABEL en server/src/utils/labels.js.
export const LEGAL_PROCESS_TYPE_LABELS = {
  cesion: 'Cesión',
  dacion: 'Dación',
  adjudicacion: 'Adjudicación',
};

// Mapeadas a las 5 variantes que soporta Badge, mismo criterio que STATUS_VARIANTS
export const CATEGORY_VARIANTS = {
  remate: 'primary',
  renta: 'warning',
  compra_venta: 'success',
};

// Línea de negocio — para Property es el eje que separa por completo las secciones públicas
// del sitio (5 pestañas, ver PROPERTY_LINE_TABS en PropertiesPage.jsx); independiente de
// `category`, que sigue siendo una subclasificación interna solo dentro de la línea `remate`
// (ver PropertyCard/PropertyDetailPage). Mismos 5 valores en Property/Lead/PropertyAlert.
// Ver migración 20260827000000-expand-property-businessline.js (y las hermanas de Lead/
// PropertyAlert) — 'infonavit' se renombró a 'credito' y se agregaron 'renta'/'contado'/
// 'inversion'. Agregar una línea nueva en el futuro es sumar una entrada acá + el valor al
// ENUM `businessLine` de los 3 modelos.
export const BUSINESS_LINE_LABELS = {
  remate: 'Remates Bancarios',
  credito: 'Con Crédito',
  renta: 'En Renta',
  contado: 'De Contado',
  inversion: 'Inversiones',
};

export const BUSINESS_LINE_VARIANTS = {
  remate: 'primary',
  credito: 'success',
  renta: 'warning',
  contado: 'default',
  inversion: 'danger',
};

// Fuente única de copy por línea de negocio. Todas conviven en el mismo módulo /propiedades
// (selector de tabs, ver TabBar en PropertiesPage) — no hay landing ni ruta separada por línea,
// así que solo `remate` usa los campos de hero/CTA/SEO (el home sigue enfocado exclusivamente
// en remates, ver HomePage.jsx). El resto de los campos (listingTitle/listingDescription/
// priceLabel/keywordsPrefix/descriptionSuffix) los leen todas las líneas: PropertiesPage para el
// H1/SEO que cambia al alternar de tab, y PropertyDetailPage/SEO/PropertyCard para mostrar la
// propiedad correctamente sin importar desde qué tab se llegó.
export const BUSINESS_LINE_CONTENT = {
  remate: {
    heroBadge: 'Precios del 30% al 70% por debajo del mercado.',
    heroTitle: 'Remates Bancarios',
    heroTitleAccent: 'en México',
    heroSlogan:
      'Has llegado al lugar correcto para hacer crecer tus inversiones, con más de 28 años de experiencia.',
    ctaText: '¿Te interesa alguna propiedad o inversión?',
    listingPath: '/propiedades',
    listingTitle: 'Propiedades en Remate',
    listingDescription:
      'Compra casas, departamentos y terrenos en remate bancario a precios por debajo del mercado en Chihuahua, Ciudad Juárez y Querétaro.',
    seoTitle: 'Comprar Casas en Remate Bancario en México',
    seoDescription:
      'Encuentra propiedades en remate bancario en Chihuahua, Ciudad Juárez y Querétaro. Casas, departamentos y terrenos del 30% al 70% por debajo del valor comercial.',
    priceLabel: 'Precio de remate',
    keywordsPrefix: 'remate bancario',
    descriptionSuffix: 'en remate bancario',
  },
  credito: {
    listingPath: '/propiedades',
    listingTitle: 'Propiedades con Crédito',
    listingDescription: 'Encuentra tu próxima vivienda con crédito Infonavit, Fovissste o hipotecario.',
    priceLabel: 'Precio',
    keywordsPrefix: 'crédito infonavit, crédito hipotecario, fovissste',
    descriptionSuffix: 'con crédito',
  },
  renta: {
    listingPath: '/propiedades',
    listingTitle: 'Propiedades en Renta',
    listingDescription:
      'Encuentra casas, departamentos y locales en renta en Chihuahua, Ciudad Juárez y Querétaro.',
    priceLabel: 'Renta mensual',
    keywordsPrefix: 'casas en renta, departamentos en renta',
    descriptionSuffix: 'en renta',
  },
  contado: {
    listingPath: '/propiedades',
    listingTitle: 'Propiedades de Contado',
    listingDescription: 'Compra tu propiedad de contado, sin trámites de crédito.',
    priceLabel: 'Precio de contado',
    keywordsPrefix: 'compra de contado, venta de contado',
    descriptionSuffix: 'de contado',
  },
  inversion: {
    listingPath: '/propiedades',
    listingTitle: 'Propiedades de Inversión',
    listingDescription: 'Propiedades ideales para inversión con alto potencial de retorno.',
    priceLabel: 'Precio de inversión',
    keywordsPrefix: 'inversión inmobiliaria, propiedades de inversión',
    descriptionSuffix: 'para inversión',
  },
};

// Fondo del <select> de estatus en la tabla admin (AdminPropertiesPage) — no puede ser un
// <Badge> porque es el control de formulario mismo, pero usa la misma familia -300 en dark
// que Badge para que se vea como el mismo estado en todas partes.
export const STATUS_SELECT_COLORS = {
  disponible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  en_revision: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  apartado: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-300',
  vendido: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  de_vuelta: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
};

// Punto de color del historial de cambios de estatus (PropertyFormPage)
export const STATUS_DOT_COLORS = {
  disponible: 'bg-green-500',
  en_revision: 'bg-yellow-500',
  apartado: 'bg-accent-500',
  vendido: 'bg-red-500',
  de_vuelta: 'bg-gray-400',
};

// Tarjetas "Estatus del inventario" del Dashboard — mismo criterio que
// PIPELINE_STAGE_BAR_COLORS: encoding visual distinto (tile vs. badge), por eso no comparte
// clases con STATUS_VARIANTS, pero es una sola fuente para las 5 tarjetas.
export const STATUS_STAT_COLORS = {
  disponible: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-300',
  en_revision: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300',
  apartado: 'text-accent-600 bg-accent-50 dark:bg-accent-900/20 dark:text-accent-300',
  vendido: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-300',
  de_vuelta: 'text-gray-600 bg-gray-50 dark:bg-gray-700/20 dark:text-gray-300',
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

// Motivos de contacto asignables al editar un prospecto — excluye 'informacion' y
// 'propiedades_similares' (valores históricos, ver LEAD_TYPE_LABELS) para no ofrecer en el
// selector opciones que el backend rechazaría (VALID_LEAD_TYPE en leadController.js).
// Mismo patrón que NON_TERMINAL_PIPELINE_STAGE_OPTIONS más abajo.
export const LEAD_TYPE_OPTIONS = Object.entries(LEAD_TYPE_LABELS)
  .filter(([value]) => !['informacion', 'propiedades_similares'].includes(value))
  .map(([value, label]) => ({ value, label }));

// Mismos valores de `type` que LEAD_TYPE_LABELS (el backend solo acepta las claves de
// VALID_LEAD_TYPE en leadController.js) pero con textos redactados en referencia a "esta
// propiedad" — usados por ContactForm.jsx únicamente cuando el formulario vive dentro de
// PropertyDetailPage (recibe `propertyId`), para que el listado de motivos no sea idéntico
// al del formulario genérico de ContactPage.jsx. Se excluyen rentar_propiedad/vender_propiedad
// porque no aplican al contexto de "estoy viendo esta propiedad en venta".
export const PROPERTY_LEAD_TYPE_LABELS = {
  comprar_propiedad: 'Quiero adquirir esta propiedad',
  invertir_remates: 'Me interesa como inversión',
  cita: 'Quiero agendar una visita a esta propiedad',
  contacto: 'Quiero más información de esta propiedad',
  asesoria_financiera: 'Quiero asesoría de financiamiento para esta propiedad',
  otro: 'Otro',
};

// Rediseño CRM — "¿qué está buscando?" estructurado. Reutilizan los mismos catálogos que
// CITY_LABELS/TYPE_LABELS (Property/PropertyAlert) en vez de definir uno propio; 'otra' se
// excluye porque el ENUM de Lead.searchCity no lo admite (mismo criterio que PropertyAlert.city).
export const LEAD_SEARCH_CITY_OPTIONS = labelsToOptions(CITY_LABELS, ['otra']);
export const LEAD_SEARCH_TYPE_OPTIONS = labelsToOptions(TYPE_LABELS);

export const LEAD_URGENCY_LABELS = {
  inmediata: 'Inmediata',
  '1_3_meses': '1 a 3 meses',
  '3_6_meses': '3 a 6 meses',
  mas_6_meses: 'Más de 6 meses',
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

// CRM Comercial — embudo de 9 etapas (reemplaza el status de 4 valores en la UI; el
// backend sigue escribiendo `status` en paralelo por compatibilidad, ver
// server/src/utils/pipelineHelpers.js legacyStatusFor). El orden de estas claves es la
// única fuente del orden de despliegue en Kanban (KanbanBoard.jsx) y en el embudo de
// ReportsSection — no hay nada más que reordenar aparte de este objeto.
export const PIPELINE_STAGE_LABELS = {
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

// Mapeadas a las 5 variantes que soporta Badge (default/success/warning/danger/primary)
export const PIPELINE_STAGE_VARIANTS = {
  nuevo: 'primary',
  contactado: 'warning',
  interesado: 'warning',
  negociacion: 'warning',
  cita_agendada: 'primary',
  cita_realizada: 'primary',
  cita_con_seguimiento: 'primary',
  venta_realizada: 'success',
  no_interesado: 'default',
  lista_espera: 'default',
};

export const TERMINAL_STAGES = ['venta_realizada', 'no_interesado', 'lista_espera'];

// Etapas activas del embudo — usado dondequiera que solo se pueda elegir un destino no
// terminal (batch actions, modal de reapertura): las terminales siempre pasan por su propio
// flujo dedicado (CloseLeadModal / ReopenLeadModal), nunca por una selección directa de etapa.
export const NON_TERMINAL_PIPELINE_STAGE_OPTIONS = Object.entries(PIPELINE_STAGE_LABELS)
  .filter(([value]) => !TERMINAL_STAGES.includes(value))
  .map(([value, label]) => ({ value, label }));

// Color de barra por etapa en los reportes (ReportsSection del Dashboard) — a diferencia de
// PIPELINE_STAGE_VARIANTS (que agrupa varias etapas bajo el mismo estado de Badge), aquí
// cada etapa necesita un color distinto para poder distinguirse en la misma gráfica. Las
// dos etapas terminales sí reutilizan el verde/gris ya establecido en Badge/Kanban para
// "venta"/"perdido"; el resto sigue un orden categórico fijo, nunca por posición en el
// arreglo (evita que los colores cambien si una fila se filtra por tener total 0). Orden
// validado con el script de accesibilidad de la skill dataviz (separación ante daltonismo
// y contraste normal) contra ambos fondos — solo el gris "sin datos" queda fuera del piso
// de croma a propósito (siempre va acompañado de su etiqueta de texto visible). `cita_con_
// seguimiento` (cyan) se agregó y revalidó contra las 8 anteriores con ese mismo script al
// sumar la 9na etapa — no introduce fallas nuevas más allá de las ya aceptadas del gris.
export const PIPELINE_STAGE_BAR_COLORS = {
  nuevo: 'bg-blue-600 dark:bg-blue-500',
  contactado: 'bg-teal-600 dark:bg-teal-400',
  interesado: 'bg-orange-600 dark:bg-orange-400',
  negociacion: 'bg-violet-600 dark:bg-violet-400',
  cita_agendada: 'bg-pink-600 dark:bg-pink-400',
  cita_realizada: 'bg-amber-600 dark:bg-amber-400',
  cita_con_seguimiento: 'bg-cyan-600 dark:bg-cyan-400',
  venta_realizada: 'bg-green-600 dark:bg-green-400',
  no_interesado: 'bg-gray-400 dark:bg-gray-500',
  lista_espera: 'bg-slate-600 dark:bg-slate-300',
};

// Mismo tono por etapa que PIPELINE_STAGE_BAR_COLORS (Embudo comercial), pero como par
// badge/degradado claro para GradientListCard en ProspectosSection — badge y degradado
// definidos juntos en la misma entrada (ver comentario de FEEDBACK_CATEGORY_COLORS arriba).
export const PIPELINE_STAGE_CARD_COLORS = {
  nuevo: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    gradient: 'from-blue-400/50 dark:from-blue-500/25',
  },
  contactado: {
    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    gradient: 'from-teal-400/50 dark:from-teal-500/25',
  },
  interesado: {
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    gradient: 'from-orange-400/50 dark:from-orange-500/25',
  },
  negociacion: {
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    gradient: 'from-violet-400/50 dark:from-violet-500/25',
  },
  cita_agendada: {
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
    gradient: 'from-pink-400/50 dark:from-pink-500/25',
  },
  cita_realizada: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    gradient: 'from-amber-400/50 dark:from-amber-500/25',
  },
  cita_con_seguimiento: {
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    gradient: 'from-cyan-400/50 dark:from-cyan-500/25',
  },
  venta_realizada: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    gradient: 'from-green-400/50 dark:from-green-500/25',
  },
  no_interesado: {
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700/40 dark:text-gray-300',
    gradient: 'from-gray-400/50 dark:from-gray-500/25',
  },
  lista_espera: {
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    gradient: 'from-slate-400/50 dark:from-slate-500/25',
  },
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
  credito_hipotecario: 'Crédito',
  contado: 'Contado',
};

// Rangos de presupuesto para el formulario público "Contactar asesor" (ver ContactForm) —
// el prospecto elige un rango en vez de teclear un monto exacto, que casi nadie conoce de
// memoria en el primer contacto. El value que viaja a Lead.budgetAmount es el punto medio de
// cada rango (el límite superior en el último, abierto); sigue siendo editable a un monto
// exacto después desde el CRM si el asesor obtiene el dato preciso en una llamada.
export const BUDGET_RANGE_OPTIONS = [
  { value: 400000, label: 'Menos de $500,000' },
  { value: 750000, label: '$500,000 - $1,000,000' },
  { value: 1500000, label: '$1,000,000 - $2,000,000' },
  { value: 2500000, label: 'Más de $2,000,000' },
];

export const FEEDBACK_CATEGORY_LABELS = {
  queja: 'Queja',
  comentario: 'Comentario',
  sugerencia: 'Sugerencia',
};

// Badge y degradado del mismo dominio SIEMPRE se definen juntos, en la misma entrada — antes
// vivían en dos mapas separados (FEEDBACK_CATEGORY_VARIANTS con las 5 variantes genéricas de
// Badge + FEEDBACK_CATEGORY_GRADIENT con clases Tailwind literales) que solo coincidían por
// casualidad en 2 de 3 categorías: "Comentario" usaba la variante `primary` (dorado/accent de
// marca) para el badge mientras su degradado era azul — nunca fueron el mismo color. Usado por
// GradientListCard (BuzonAdminPage, ProspectosSection, ApplicationsPage).
export const FEEDBACK_CATEGORY_COLORS = {
  queja: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    gradient: 'from-red-400/50 dark:from-red-500/25',
  },
  comentario: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    gradient: 'from-blue-400/50 dark:from-blue-500/25',
  },
  sugerencia: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    gradient: 'from-green-400/50 dark:from-green-500/25',
  },
};

export const FEEDBACK_STATUS_LABELS = { nuevo: 'Nuevo', leido: 'Leído' };

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

// Postulaciones (ApplicationsPage) — antes vivían inline como `statusVariant` sin degradado;
// badge y degradado definidos juntos en la misma entrada (ver comentario de
// FEEDBACK_CATEGORY_COLORS arriba) para GradientListCard.
export const APPLICATION_STATUS_LABELS = {
  nueva: 'Nueva',
  en_revision: 'En revisión',
  entrevista: 'Entrevista',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};
export const APPLICATION_STATUS_COLORS = {
  nueva: {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    gradient: 'from-blue-400/50 dark:from-blue-500/25',
  },
  en_revision: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    gradient: 'from-amber-400/50 dark:from-amber-500/25',
  },
  entrevista: {
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    gradient: 'from-violet-400/50 dark:from-violet-500/25',
  },
  aceptada: {
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    gradient: 'from-green-400/50 dark:from-green-500/25',
  },
  rechazada: {
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    gradient: 'from-red-400/50 dark:from-red-500/25',
  },
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
