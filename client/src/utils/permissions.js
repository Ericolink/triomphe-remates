// CRM de Leads — espejo del helper de autorización del backend
// (server/src/utils/leadAccess.js). Solo se usa para decidir qué mostrar/ocultar en la UI;
// el backend es la única fuente de verdad real, esto nunca reemplaza la validación del API.

export function crmAccessLevel(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  return user.crmRole || null;
}

export const hasCrmAccess = (user) => crmAccessLevel(user) !== null;

// Eliminar leads (individual o en lote) siempre fue exclusivo de `role==='admin'` en el
// backend (ver routes/leads.js) — ningún crmRole lo obtiene, ni siquiera coordinador_ventas.
export const isAdmin = (user) => user?.role === 'admin';

export const canAssignLeads = (user) =>
  ['admin', 'coordinador_ventas'].includes(crmAccessLevel(user));

// Un Asesor de Ventas solo trabaja los leads que ya se le asignaron, no crea nuevos.
export const canCreateLeads = (user) =>
  hasCrmAccess(user) && crmAccessLevel(user) !== 'asesor_ventas';

export const isCapturista = (user) => crmAccessLevel(user) === 'capturista';

export const isAsesor = (user) => crmAccessLevel(user) === 'asesor_ventas';

export const seesAllLeads = (user) => ['admin', 'coordinador_ventas'].includes(crmAccessLevel(user));

// Espejo exacto de canEditLead en leadAccess.js — autorización por-registro (no solo por
// rol): un capturista pierde edición sobre un lead en cuanto se le asigna un responsable,
// y un asesor solo edita lo que tiene asignado. Gatea el mismo conjunto de acciones que el
// backend cubre con esta función: PUT /leads/:id (campos generales, cambio de etapa no
// terminal, close-won/close-lost/reopen), agendar citas y agregar/quitar propiedades de
// interés. No cubre notas/actividades/WhatsApp, que en el backend solo requieren
// `canViewLead` (cualquiera con acceso de lectura al lead puede registrar seguimiento).
export function canEditLead(user, lead) {
  if (!lead) return false;
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'coordinador_ventas') return true;
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  if (level === 'capturista') {
    return lead.createdByUserId === user.id && lead.assignedToUserId == null;
  }
  return false;
}
