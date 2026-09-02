// Fuente centralizada única para traducir un evento técnico de Audit Log
// (`action` + `resource`, con algunos ajustes según `detail`) a su presentación humana:
// área, subárea, etiqueta, ícono y si es un evento crítico. NINGÚN otro archivo (backend
// o frontend) debe definir sus propios mapas de estos nombres — este es el único lugar.
//
// `icon` es solo una clave string (no un componente) — el mapeo a un ícono real de
// lucide-react vive en client/src/utils/auditIcons.jsx, que la mantiene sincronizada
// contra ICONS_BY_AREA de abajo.
//
// Clasificación de "crítico" (ver sección 11 del rediseño): un evento se marca crítico
// solo si cae en una de estas categorías concretas, nunca por cómo "suena" su nombre:
//   - cualquier `delete`
//   - creación/actualización/eliminación de usuarios (`resource: 'user'`)
//   - un `update` de usuario que cambia el campo `role` (cambio de permisos)
//   - un intento de login fallido (`action: 'login', result: 'failed'`)

const AREAS = {
  CRM: 'CRM',
  PROPIEDADES: 'Propiedades',
  USUARIOS: 'Usuarios',
  AUTENTICACION: 'Autenticación',
  MARKETING: 'Marketing',
  CONFIGURACION: 'Configuración',
  ANALYTICS: 'Analytics',
  SEGURIDAD: 'Seguridad',
  SISTEMA: 'Sistema',
};

// Todo `resource` que el sistema puede llegar a registrar. Usado por el modelo
// (validate: isIn) para que un `resource` mal escrito falle de forma explícita en vez
// de perderse en silencio como pasaba con el ENUM (ver migración 20260904000001).
const KNOWN_RESOURCES = [
  'property',
  'lead',
  'feedback',
  'user',
  'job',
  'application',
  'alert',
  'campaign',
  'activity',
  'appointment',
  'task',
  'deal',
  'testimonial',
];

const ICONS_BY_AREA = {
  [AREAS.CRM]: 'users',
  [AREAS.PROPIEDADES]: 'home',
  [AREAS.USUARIOS]: 'user-cog',
  [AREAS.AUTENTICACION]: 'lock',
  [AREAS.MARKETING]: 'megaphone',
  [AREAS.CONFIGURACION]: 'settings',
  [AREAS.ANALYTICS]: 'bar-chart',
  [AREAS.SEGURIDAD]: 'shield-alert',
  [AREAS.SISTEMA]: 'server',
};

const ACTION_VERB = { create: 'Crear', update: 'Editar', delete: 'Eliminar', export: 'Exportar' };

// entry: { area, subarea, label, resourceLabel? } — resourceLabel se usa para armar el
// texto de "registro afectado" (ej. "Prospecto #581"), tomado de constants.js/labels del
// frontend si existiera equivalente, pero aquí solo el nombre corto en español.
const RESOURCE_META = {
  lead: { area: AREAS.CRM, subarea: 'Prospectos', resourceLabel: 'Prospecto' },
  activity: { area: AREAS.CRM, subarea: 'Prospectos', resourceLabel: 'Actividad' },
  deal: { area: AREAS.CRM, subarea: 'Prospectos', resourceLabel: 'Cierre' },
  appointment: { area: AREAS.CRM, subarea: 'Citas', resourceLabel: 'Cita' },
  alert: { area: AREAS.CRM, subarea: 'Lista de espera', resourceLabel: 'Alerta' },
  feedback: { area: AREAS.CRM, subarea: 'Buzón', resourceLabel: 'Mensaje' },
  property: { area: AREAS.PROPIEDADES, subarea: 'Inventario', resourceLabel: 'Propiedad' },
  user: { area: AREAS.USUARIOS, subarea: 'Cuentas', resourceLabel: 'Usuario' },
  campaign: { area: AREAS.MARKETING, subarea: 'Campañas', resourceLabel: 'Campaña' },
  testimonial: { area: AREAS.MARKETING, subarea: 'Testimonios', resourceLabel: 'Testimonio' },
  job: { area: AREAS.SISTEMA, subarea: 'Reclutamiento', resourceLabel: 'Vacante' },
  application: { area: AREAS.SISTEMA, subarea: 'Reclutamiento', resourceLabel: 'Postulación' },
  task: { area: AREAS.CRM, subarea: 'Prospectos', resourceLabel: 'Tarea' },
};

// Overrides puntuales por action+resource cuando el verbo genérico no calza bien
// ("Login" no es "Crear usuario", es su propia acción de Autenticación).
const ACTION_OVERRIDES = {
  'login:user': { area: AREAS.AUTENTICACION, subarea: 'Acceso', label: 'Inicio de sesión' },
  'update:property__promoted': {
    area: AREAS.PROPIEDADES,
    subarea: 'Promoción',
    label: 'Actualizar promoción',
  },
  'update:property__image': {
    area: AREAS.PROPIEDADES,
    subarea: 'Imágenes',
    label: 'Actualizar imágenes',
  },
  'delete:property__image': {
    area: AREAS.PROPIEDADES,
    subarea: 'Imágenes',
    label: 'Eliminar imagen',
  },
};

function baseKey(action, resource) {
  return `${action}:${resource}`;
}

// `detail` ya viene parseado (objeto), no el string JSON crudo.
function classifyAuditEvent({ action, resource, resourceId, detail, result }) {
  const meta = RESOURCE_META[resource] || { area: AREAS.SISTEMA, subarea: 'General', resourceLabel: resource };

  let area = meta.area;
  let subarea = meta.subarea;
  let label = `${ACTION_VERB[action] || action} ${meta.resourceLabel?.toLowerCase() || resource}`;
  // `resource==='user'` cubre create/update/delete de cuentas — pero login/logout también
  // usan resource:'user' (referencian al actor, no una mutación de cuenta) y no deben
  // marcarse críticos solo por eso; el login fallido se marca crítico aparte, más abajo.
  let critical = action === 'delete' || (resource === 'user' && action !== 'login' && action !== 'logout');

  // Login fallido pasa de Autenticación a Seguridad y se marca crítico — es la única
  // señal de intento de acceso indebido que el sistema hoy puede detectar.
  if (action === 'login' && result === 'failed') {
    area = AREAS.SEGURIDAD;
    subarea = 'Accesos fallidos';
    label = 'Intento de inicio de sesión fallido';
    critical = true;
  } else if (ACTION_OVERRIDES[baseKey(action, resource)]) {
    const override = ACTION_OVERRIDES[baseKey(action, resource)];
    area = override.area;
    subarea = override.subarea;
    label = override.label;
  } else if (action === 'update' && resource === 'property' && detail && 'isPromoted' in detail) {
    ({ area, subarea, label } = ACTION_OVERRIDES['update:property__promoted']);
  } else if (
    action === 'update' &&
    resource === 'property' &&
    detail &&
    ('coverImageId' in detail || 'imageIds' in detail)
  ) {
    ({ area, subarea, label } = ACTION_OVERRIDES['update:property__image']);
  } else if (action === 'delete' && resource === 'property' && detail && 'imageId' in detail) {
    ({ area, subarea, label } = ACTION_OVERRIDES['delete:property__image']);
  } else if (action === 'update' && resource === 'user') {
    const changedRole =
      (detail?.role !== undefined) ||
      (Array.isArray(detail?.changes) && detail.changes.some((c) => c.field === 'role'));
    if (changedRole) {
      subarea = 'Permisos';
      label = 'Editar permisos';
      critical = true;
    } else {
      subarea = 'Cuentas';
      label = 'Editar usuario';
    }
  } else if (action === 'export') {
    subarea = `${subarea} · Exportación`;
    label = `Exportar ${meta.resourceLabel?.toLowerCase() || resource}`;
  }

  const resourceLabelText = meta.resourceLabel
    ? `${meta.resourceLabel} ${resourceId != null ? `#${resourceId}` : ''}`.trim()
    : null;

  return {
    area,
    subarea,
    label,
    icon: ICONS_BY_AREA[area] || ICONS_BY_AREA[AREAS.SISTEMA],
    critical,
    resourceLabel: resourceLabelText,
  };
}

// Áreas ofrecidas como filtro (todas las 9 pedidas por el rediseño, aunque Configuración
// y Analytics no tengan eventos todavía — el filtro es legítimo, solo devuelve vacío).
const AREA_LIST = Object.values(AREAS);

// Traduce un área elegida en el filtro a la lista de `resource` que hay que buscar.
// Seguridad es un caso especial: no es un `resource` propio, es `resource:'user',
// action:'login', result:'failed'` — se resuelve aparte en el controller.
function resourcesForArea(area) {
  return Object.entries(RESOURCE_META)
    .filter(([, meta]) => meta.area === area)
    .map(([resource]) => resource);
}

// Búsqueda: permite que un término como "editar prospecto" encuentre las filas
// action=update,resource=lead aunque la base de datos nunca guarde ese texto literal.
// Es un recorrido en memoria de ~15 entradas de RESOURCE_META × 5 acciones — trivial en
// costo, se ejecuta una vez por request de búsqueda, no por fila de la tabla.
function searchableLabelMatches(term) {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];

  const matches = [];
  for (const resource of Object.keys(RESOURCE_META)) {
    for (const action of Object.keys(ACTION_VERB)) {
      const { label } = classifyAuditEvent({ action, resource, resourceId: null, detail: null, result: 'success' });
      if (label.toLowerCase().includes(needle)) matches.push({ action, resource });
    }
  }
  if ('inicio de sesión'.includes(needle) || needle.includes('login') || needle.includes('sesión')) {
    matches.push({ action: 'login', resource: 'user' });
  }
  return matches;
}

// Traduce la MISMA regla de "crítico" de classifyAuditEvent() a un WHERE de Sequelize, para
// poder filtrar por crítico en SQL (KPI "Acciones críticas" clickeable) sin traer la tabla
// completa a JS. La regla es 100% expresable en SQL porque ninguna de sus condiciones
// depende de `detail` — el caso "cambio de rol" no necesita chequearse aparte: ya cae bajo
// "cualquier update de resource:'user'", que ya es crítico. Si algún día `classifyAuditEvent`
// gana una condición que SÍ dependa de `detail`, esta función debe actualizarse a la par.
function criticalWhereClause(Op) {
  return {
    [Op.or]: [
      { action: 'delete' },
      { resource: 'user', action: { [Op.notIn]: ['login', 'logout'] } },
      { action: 'login', result: 'failed' },
    ],
  };
}

module.exports = {
  AREAS,
  AREA_LIST,
  KNOWN_RESOURCES,
  classifyAuditEvent,
  resourcesForArea,
  searchableLabelMatches,
  criticalWhereClause,
};
