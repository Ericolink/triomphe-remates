// Espejo del helper de autorización del backend para todo lo que no sea CRM de leads
// (server/src/utils/leadAccess.js cubre esa parte) — solo se usa para decidir qué
// mostrar/ocultar en la UI; el backend es la única fuente de verdad real, esto nunca
// reemplaza la validación del API.

export const isAdmin = (user) => user?.role === 'admin';

// --- CRM de Leads --------------------------------------------------------
// Espejo exacto de crmAccessLevel en leadAccess.js.
export function crmAccessLevel(user) {
  if (!user) return null;
  if (['admin', 'asistente_administrativo', 'asesor_ventas'].includes(user.role)) {
    return user.role;
  }
  return null;
}

export const hasCrmAccess = (user) => crmAccessLevel(user) !== null;

export const canAssignLeads = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

// Eliminar leads (individual o en lote) — espejo exacto de routes/leads.js.
export const canDeleteLeads = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

// Un Asesor de Ventas solo trabaja los leads que ya se le asignaron, no crea nuevos.
export const canCreateLeads = (user) => hasCrmAccess(user) && user?.role !== 'asesor_ventas';

// Espejo exacto de canEditLead en leadAccess.js — autorización por-registro (no solo por
// rol): un asesor solo edita lo que tiene asignado.
export function canEditLead(user, lead) {
  if (!lead) return false;
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  return false;
}

// --- Inventario / Propiedades --------------------------------------------
// Crear/editar/eliminar-imagen/promover propiedades — Coordinador de ventas y Asesor de
// ventas solo pueden VER el inventario (ver canExportInventory / lectura sin gate).
export const canManageInventory = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

// Eliminar propiedades — espejo exacto de routes/properties.js.
export const canDeleteProperties = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

// Descargar el inventario — Excel trae datos internos/administrativos (observaciones,
// clave de búsqueda, utilidad, etc.), así que se queda reservado a Admin/Asistente
// administrativo. PDF es un documento de presentación más acotado, así que también lo
// pueden descargar Coordinador y Asesor de ventas (espejo exacto de routes/export.js).
export const canExportExcel = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

export const canExportPdf = (user) =>
  ['admin', 'asistente_administrativo', 'coordinador_ventas', 'asesor_ventas'].includes(
    user?.role
  );

// --- Módulos de soporte (vacantes, testimonios, buzón, alertas, analytics, campañas) ---
// Coordinador de ventas y Asesor de ventas no tienen acceso a ninguno de estos.
export const hasBackofficeAccess = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

// Ruta a la que se manda a cada rol después de iniciar sesión / al entrar a "/admin" —
// Coordinador de ventas y Asesor de ventas no tienen acceso al dashboard de analytics.
export function defaultRouteFor(user) {
  if (user?.role === 'coordinador_ventas') return '/admin/propiedades';
  if (user?.role === 'asesor_ventas') return '/admin/crm';
  return '/admin/dashboard';
}
