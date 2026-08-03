// CRM de Leads — espejo del helper de autorización del backend
// (server/src/utils/leadAccess.js). Solo se usa para decidir qué mostrar/ocultar en la UI;
// el backend es la única fuente de verdad real, esto nunca reemplaza la validación del API.

export function crmAccessLevel(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  return user.crmRole || null;
}

export const hasCrmAccess = (user) => crmAccessLevel(user) !== null;

export const canAssignLeads = (user) =>
  ['admin', 'coordinador_ventas'].includes(crmAccessLevel(user));

// Un Asesor de Ventas solo trabaja los leads que ya se le asignaron, no crea nuevos.
export const canCreateLeads = (user) =>
  hasCrmAccess(user) && crmAccessLevel(user) !== 'asesor_ventas';

export const isCapturista = (user) => crmAccessLevel(user) === 'capturista';

export const isAsesor = (user) => crmAccessLevel(user) === 'asesor_ventas';

export const seesAllLeads = (user) => ['admin', 'coordinador_ventas'].includes(crmAccessLevel(user));
