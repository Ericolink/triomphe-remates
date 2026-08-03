// CRM de Leads — punto único de verdad para autorización por fila. Nada fuera de este
// archivo debería reimplementar estas reglas: cualquier controller que necesite saber qué
// puede ver/editar/asignar un usuario en el módulo de prospectos importa de aquí.
//
// Niveles (de más a menos acceso):
//  - admin: acceso total, siempre (role==='admin', crmRole no se consulta).
//  - coordinador_ventas: ve/edita todos los leads, puede asignar/reasignar responsable.
//  - capturista: ve los leads que él creó (incluso ya asignados a un asesor, solo lectura
//    en ese caso); solo puede editar mientras el lead no tenga responsable asignado.
//  - asesor_ventas: ve/edita únicamente los leads asignados a él; no puede crear ni
//    reasignar.
//  - null (sin crmRole y no admin): sin acceso al CRM de leads.

function crmAccessLevel(user) {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';
  return user.crmRole || null;
}

function hasCrmAccess(user) {
  return crmAccessLevel(user) !== null;
}

// Fragmento de `where` para restringir una consulta de Lead a lo visible para `user`, o
// `null` si no hay restricción. `alias` se usa cuando Lead viene incluido en otro modelo
// (Task/Appointment/Deal) vía `include: [{ model: Lead, as: alias }]`, generando claves
// `$alias.campo$` — mismo patrón que ya usa dealController para su filtro de `search`.
function getLeadVisibilityWhere(user, { alias } = {}) {
  const level = crmAccessLevel(user);
  const key = (field) => (alias ? `$${alias}.${field}$` : field);

  if (level === 'admin' || level === 'coordinador_ventas') return null;
  if (level === 'capturista') return { [key('createdByUserId')]: user.id };
  if (level === 'asesor_ventas') return { [key('assignedToUserId')]: user.id };
  // Defensa en profundidad — no debería llegar aquí, la ruta ya bloqueó con
  // requireCrmAccess antes de que el controller alcance a construir el where.
  return { [key('id')]: -1 };
}

function canViewLead(user, lead) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'coordinador_ventas') return true;
  if (level === 'capturista') return lead.createdByUserId === user.id;
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  return false;
}

function canEditLead(user, lead) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'coordinador_ventas') return true;
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  if (level === 'capturista') {
    return lead.createdByUserId === user.id && lead.assignedToUserId == null;
  }
  return false;
}

function canAssignLeads(user) {
  const level = crmAccessLevel(user);
  return level === 'admin' || level === 'coordinador_ventas';
}

module.exports = {
  crmAccessLevel,
  hasCrmAccess,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
};
