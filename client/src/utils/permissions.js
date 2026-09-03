// Espejo del helper de autorización del backend para todo lo que no sea CRM de leads
// (server/src/utils/leadAccess.js cubre esa parte) — solo se usa para decidir qué
// mostrar/ocultar en la UI; el backend es la única fuente de verdad real, esto nunca
// reemplaza la validación del API.

export const isAdmin = (user) => user?.role === 'admin';

// Ruta /admin/mi-dashboard: además del asesor individual, un coordinador_ventas ve el
// mismo dashboard pero agregado a los prospectos de todo su equipo (GET /crm/my-dashboard
// ya devuelve eso para su rol, ver leadAccess.getLeadVisibilityWhere).
export const canAccessMyDashboard = (user) =>
  ['asesor_ventas', 'coordinador_ventas'].includes(user?.role);

// --- CRM de Leads --------------------------------------------------------
// Espejo exacto de crmAccessLevel en leadAccess.js.
export function crmAccessLevel(user) {
  if (!user) return null;
  if (['admin', 'asistente_administrativo', 'coordinador_ventas', 'asesor_ventas'].includes(user.role)) {
    return user.role;
  }
  return null;
}

export const hasCrmAccess = (user) => crmAccessLevel(user) !== null;

// Boolean grueso — "¿este rol puede asignar responsable, en principio?", usado para
// gating de UI (mostrar el selector de Responsable). Espejo exacto de canAssignLeads en
// leadAccess.js — el backend es quien realmente decide A QUIÉN puede asignar cada uno
// (canAssignLeadTo), el frontend solo necesita saber si mostrar el selector.
export const canAssignLeads = (user) =>
  ['admin', 'asistente_administrativo', 'coordinador_ventas'].includes(user?.role);

// Eliminar leads (individual o en lote) — espejo exacto de routes/leads.js.
export const canDeleteLeads = (user) =>
  ['admin', 'asistente_administrativo'].includes(user?.role);

// Un Asesor de Ventas y un Coordinador de Ventas SÍ pueden crear prospectos (excepción
// explícita del dueño del negocio) — quedan auto-asignados a él mismo, ver
// leadController.createLead. Queda igual que hasCrmAccess; se mantiene como export aparte
// por legibilidad en los call sites.
export const canCreateLeads = (user) => hasCrmAccess(user);

// Espejo exacto de canEditLead en leadAccess.js — autorización por-registro (no solo por
// rol): un asesor o coordinador solo edita lo que tiene asignado a sí mismo. Un
// coordinador SÍ puede reasignar un prospecto de su equipo aunque no sea suyo (ver
// canAssignLeads/backend canAssignLeadTo), pero eso no cuenta como "editar" para esta
// función — es una acción aparte, gateada directamente en el selector de Responsable.
export function canEditLead(user, lead) {
  if (!lead) return false;
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'coordinador_ventas' || level === 'asesor_ventas') {
    return lead.assignedToUserId === user.id;
  }
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
// Coordinador de ventas y Asesor de ventas no tienen acceso al dashboard de analytics de
// toda la empresa, pero sí a su propio /admin/mi-dashboard (el de un coordinador agrega los
// datos de todo su equipo) — es su punto de partida natural ("¿cómo va mi/mi equipo y qué
// debo atender hoy?"), no el CRM directo.
export function defaultRouteFor(user) {
  if (canAccessMyDashboard(user)) return '/admin/mi-dashboard';
  return '/admin/dashboard';
}
