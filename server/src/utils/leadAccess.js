const { Op } = require('sequelize');

// CRM de Leads — punto único de verdad para autorización por fila. Nada fuera de este
// archivo debería reimplementar estas reglas: cualquier controller que necesite saber qué
// puede ver/editar/asignar un usuario en el módulo de prospectos importa de aquí.
//
// Niveles (de más a menos acceso):
//  - admin: acceso total, siempre.
//  - asistente_administrativo: ve/edita todos los leads, puede asignar/reasignar
//    responsable a cualquiera, puede crear.
//  - coordinador_ventas: ve/reasigna los leads de su equipo (los suyos propios + los de
//    los asesor_ventas que supervisa, ver User.supervisorId), pero solo EDITA (cambia
//    pipeline/campos) los que tiene asignados a sí mismo — reasignar es la única acción
//    que puede hacer sobre un lead de un asesor que no es él. Puede crear leads. Requiere
//    que `user.supervisedUserIds` (array de ids de sus asesores) venga precalculado por
//    crmAccessMiddleware.requireCrmAccess antes de llegar aquí — estas funciones son
//    síncronas a propósito, no hacen su propia query.
//  - asesor_ventas: ve/edita únicamente los leads asignados a él; puede crear (quedan
//    auto-asignados a sí mismo); no puede reasignar.
//  - null: sin acceso al CRM de leads.

function crmAccessLevel(user) {
  if (!user) return null;
  if (
    user.role === 'admin' ||
    user.role === 'asistente_administrativo' ||
    user.role === 'coordinador_ventas' ||
    user.role === 'asesor_ventas'
  ) {
    return user.role;
  }
  return null;
}

function hasCrmAccess(user) {
  return crmAccessLevel(user) !== null;
}

// Ids de los asesor_ventas que supervisa este coordinador — precalculados por
// crmAccessMiddleware.requireCrmAccess y colgados de req.user, nunca calculados aquí (este
// archivo se queda síncrono).
function getSupervisedUserIds(user) {
  return user?.supervisedUserIds ?? [];
}

// "Equipo" de un usuario para efectos de visibilidad/asignación: él mismo, más — si es
// coordinador — sus asesores supervisados.
function getTeamUserIds(user) {
  const level = crmAccessLevel(user);
  if (level === 'coordinador_ventas') return [user.id, ...getSupervisedUserIds(user)];
  return [user.id];
}

// Fragmento de `where` para restringir una consulta de Lead a lo visible para `user`, o
// `null` si no hay restricción. `alias` se usa cuando Lead viene incluido en otro modelo
// (Appointment/Deal) vía `include: [{ model: Lead, as: alias }]`, generando claves
// `$alias.campo$` — mismo patrón que ya usa dealController para su filtro de `search`.
function getLeadVisibilityWhere(user, { alias } = {}) {
  const level = crmAccessLevel(user);
  const key = (field) => (alias ? `$${alias}.${field}$` : field);

  if (level === 'admin' || level === 'asistente_administrativo') return null;
  if (level === 'coordinador_ventas') {
    return { [key('assignedToUserId')]: { [Op.in]: getTeamUserIds(user) } };
  }
  if (level === 'asesor_ventas') return { [key('assignedToUserId')]: user.id };
  // Defensa en profundidad — no debería llegar aquí, la ruta ya bloqueó con
  // requireCrmAccess antes de que el controller alcance a construir el where.
  return { [key('id')]: -1 };
}

function canViewLead(user, lead) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'coordinador_ventas') return getTeamUserIds(user).includes(lead.assignedToUserId);
  if (level === 'asesor_ventas') return lead.assignedToUserId === user.id;
  return false;
}

// A diferencia de canViewLead, un coordinador NO tiene edición general sobre los leads de
// su equipo — solo sobre los que tiene asignados a sí mismo, igual que un asesor. Reasignar
// un lead de su equipo es una acción aparte, ver canAssignLeadTo.
function canEditLead(user, lead) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'coordinador_ventas' || level === 'asesor_ventas') {
    return lead.assignedToUserId === user.id;
  }
  return false;
}

// Boolean grueso — "¿este rol puede asignar responsable, en principio?" — usado para
// gating de UI (mostrar el selector de Responsable). La autorización real por
// destinatario la hace canAssignLeadTo.
function canAssignLeads(user) {
  const level = crmAccessLevel(user);
  return level === 'admin' || level === 'asistente_administrativo' || level === 'coordinador_ventas';
}

// ¿Puede `user` asignar/reasignar un lead a `targetUserId`? admin/asistente pueden asignar
// a cualquiera (sin cambios de comportamiento); un coordinador solo puede asignar a sí
// mismo o a un asesor de su propio equipo; nadie más puede asignar. `targetUserId` vacío
// (quitar responsable) siempre se permite si el rol ya pasó `canAssignLeads`.
function canAssignLeadTo(user, targetUserId) {
  const level = crmAccessLevel(user);
  if (level === 'admin' || level === 'asistente_administrativo') return true;
  if (level === 'coordinador_ventas') {
    if (!targetUserId) return true;
    return getTeamUserIds(user).includes(Number(targetUserId));
  }
  return false;
}

module.exports = {
  crmAccessLevel,
  hasCrmAccess,
  getSupervisedUserIds,
  getTeamUserIds,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
  canAssignLeadTo,
};
