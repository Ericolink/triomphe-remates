// CRM de Leads — punto único de verdad para autorización por fila. Nada fuera de este
// archivo debería reimplementar estas reglas: cualquier controller que necesite saber qué
// puede ver/editar/asignar un usuario en el módulo de prospectos importa de aquí.
//
// Niveles (de más a menos acceso):
//  - admin: acceso total, siempre.
//  - asistente_administrativo: ve/edita todos los leads, puede asignar/reasignar
//    responsable, puede crear. Ocupa el lugar que antes de la unificación de roles tenía
//    'coordinador_ventas' — ver comentario en server/src/models/User.js.
//  - asesor_ventas: ve/edita únicamente los leads asignados a él; no puede crear ni
//    reasignar.
//  - coordinador_ventas / null: sin acceso al CRM de leads (coordinador_ventas solo tiene
//    acceso a inventario, gateado aparte en las rutas de propiedades/export).

function crmAccessLevel(user) {
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'asistente_administrativo' || user.role === 'asesor_ventas') {
    return user.role;
  }
  return null;
}

function hasCrmAccess(user) {
  return crmAccessLevel(user) !== null;
}

// Fragmento de `where` para restringir una consulta de Lead a lo visible para `user`, o
// `null` si no hay restricción. `alias` se usa cuando Lead viene incluido en otro modelo
// (Appointment/Deal) vía `include: [{ model: Lead, as: alias }]`, generando claves
// `$alias.campo$` — mismo patrón que ya usa dealController para su filtro de `search`.
function getLeadVisibilityWhere(user, { alias } = {}) {
  const level = crmAccessLevel(user);
  const key = (field) => (alias ? `$${alias}.${field}$` : field);

  if (level === 'admin' || level === 'asistente_administrativo') return null;
  if (level === 'asesor_ventas') return { [key('assignedToUserId')]: user.id };
  // Defensa en profundidad — no debería llegar aquí, la ruta ya bloqueó con
  // requireCrmAccess antes de que el controller alcance a construir el where.
  return { [key('id')]: -1 };
}

function canViewLead(user, lead) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  return false;
}

function canEditLead(user, lead) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  return false;
}

function canAssignLeads(user) {
  const level = crmAccessLevel(user);
  return level === 'admin' || level === 'asistente_administrativo';
}

module.exports = {
  crmAccessLevel,
  hasCrmAccess,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
};
