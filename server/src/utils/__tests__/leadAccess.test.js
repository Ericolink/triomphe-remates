const { Op } = require('sequelize');
const {
  crmAccessLevel,
  hasCrmAccess,
  getSupervisedUserIds,
  getTeamUserIds,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
  canAssignLeadTo,
} = require('../leadAccess');

const admin = { id: 1, role: 'admin' };
// supervisedUserIds simula lo que crmAccessMiddleware.requireCrmAccess precalcula y cuelga
// de req.user antes de que estas funciones se llamen — ver el comentario en leadAccess.js.
const coordinador = { id: 2, role: 'coordinador_ventas', supervisedUserIds: [5, 6] };
const coordinadorSinEquipo = { id: 7, role: 'coordinador_ventas', supervisedUserIds: [] };
const asistente = { id: 3, role: 'asistente_administrativo' };
const asesor = { id: 4, role: 'asesor_ventas' };
const asesorDeOtroEquipo = { id: 8, role: 'asesor_ventas' };

describe('crmAccessLevel / hasCrmAccess', () => {
  test('admin siempre es "admin"', () => {
    expect(crmAccessLevel(admin)).toBe('admin');
  });

  test('coordinador_ventas SÍ tiene acceso al CRM de leads (mismo nivel que asesor + su equipo)', () => {
    expect(crmAccessLevel(coordinador)).toBe('coordinador_ventas');
    expect(hasCrmAccess(coordinador)).toBe(true);
  });

  test('asistente_administrativo y asesor_ventas tienen acceso', () => {
    expect(crmAccessLevel(asistente)).toBe('asistente_administrativo');
    expect(crmAccessLevel(asesor)).toBe('asesor_ventas');
  });

  test('sin usuario, sin acceso', () => {
    expect(crmAccessLevel(null)).toBeNull();
    expect(hasCrmAccess(null)).toBe(false);
  });
});

describe('getSupervisedUserIds / getTeamUserIds', () => {
  test('un coordinador sin supervisedUserIds precalculado devuelve equipo vacío (solo él mismo)', () => {
    expect(getSupervisedUserIds({ id: 9, role: 'coordinador_ventas' })).toEqual([]);
    expect(getTeamUserIds({ id: 9, role: 'coordinador_ventas' })).toEqual([9]);
  });

  test('el equipo de un coordinador es él mismo + sus asesores supervisados', () => {
    expect(getSupervisedUserIds(coordinador)).toEqual([5, 6]);
    expect(getTeamUserIds(coordinador)).toEqual([2, 5, 6]);
  });

  test('el equipo de cualquier otro rol es solo él mismo', () => {
    expect(getTeamUserIds(asesor)).toEqual([asesor.id]);
    expect(getTeamUserIds(admin)).toEqual([admin.id]);
  });
});

describe('getLeadVisibilityWhere', () => {
  test('admin y asistente_administrativo no tienen restricción (null)', () => {
    expect(getLeadVisibilityWhere(admin)).toBeNull();
    expect(getLeadVisibilityWhere(asistente)).toBeNull();
  });

  test('asesor se restringe a assignedToUserId', () => {
    expect(getLeadVisibilityWhere(asesor)).toEqual({ assignedToUserId: asesor.id });
  });

  test('usa la sintaxis $alias.campo$ cuando se pasa alias', () => {
    expect(getLeadVisibilityWhere(asesor, { alias: 'lead' })).toEqual({
      '$lead.assignedToUserId$': asesor.id,
    });
  });

  test('coordinador se restringe a assignedToUserId IN [él mismo, ...su equipo]', () => {
    expect(getLeadVisibilityWhere(coordinador)).toEqual({
      assignedToUserId: { [Op.in]: [2, 5, 6] },
    });
  });

  test('sin acceso (rol desconocido), restringe a un id imposible (defensa en profundidad)', () => {
    expect(getLeadVisibilityWhere({ id: 99, role: 'otro' })).toEqual({ id: -1 });
  });
});

describe('canViewLead', () => {
  test('admin y asistente_administrativo ven cualquier lead', () => {
    const lead = { assignedToUserId: 999 };
    expect(canViewLead(admin, lead)).toBe(true);
    expect(canViewLead(asistente, lead)).toBe(true);
  });

  test('asesor ve solo lo asignado a él', () => {
    expect(canViewLead(asesor, { assignedToUserId: asesor.id })).toBe(true);
    expect(canViewLead(asesor, { assignedToUserId: 999 })).toBe(false);
  });

  test('coordinador ve lo asignado a sí mismo y a cualquiera de su equipo', () => {
    expect(canViewLead(coordinador, { assignedToUserId: coordinador.id })).toBe(true);
    expect(canViewLead(coordinador, { assignedToUserId: 5 })).toBe(true);
    expect(canViewLead(coordinador, { assignedToUserId: 6 })).toBe(true);
  });

  test('coordinador NO ve un lead fuera de su equipo', () => {
    expect(canViewLead(coordinador, { assignedToUserId: asesorDeOtroEquipo.id })).toBe(false);
    expect(canViewLead(coordinadorSinEquipo, { assignedToUserId: 5 })).toBe(false);
  });
});

describe('canEditLead', () => {
  test('admin y asistente_administrativo editan cualquier lead', () => {
    const lead = { assignedToUserId: 999 };
    expect(canEditLead(admin, lead)).toBe(true);
    expect(canEditLead(asistente, lead)).toBe(true);
  });

  test('asesor edita solo lo asignado a él', () => {
    expect(canEditLead(asesor, { assignedToUserId: asesor.id })).toBe(true);
    expect(canEditLead(asesor, { assignedToUserId: 999 })).toBe(false);
  });

  test('coordinador edita solo lo asignado a sí mismo, NO lo de su equipo', () => {
    expect(canEditLead(coordinador, { assignedToUserId: coordinador.id })).toBe(true);
    expect(canEditLead(coordinador, { assignedToUserId: 5 })).toBe(false);
    expect(canEditLead(coordinador, { assignedToUserId: 6 })).toBe(false);
  });
});

describe('canAssignLeads', () => {
  test('admin, asistente_administrativo y coordinador_ventas pueden asignar (boolean grueso)', () => {
    expect(canAssignLeads(admin)).toBe(true);
    expect(canAssignLeads(asistente)).toBe(true);
    expect(canAssignLeads(coordinador)).toBe(true);
    expect(canAssignLeads(asesor)).toBe(false);
  });
});

describe('canAssignLeadTo', () => {
  test('admin y asistente_administrativo pueden asignar a cualquier id', () => {
    expect(canAssignLeadTo(admin, 12345)).toBe(true);
    expect(canAssignLeadTo(asistente, 12345)).toBe(true);
  });

  test('coordinador puede asignar a sí mismo o a un asesor de su equipo', () => {
    expect(canAssignLeadTo(coordinador, coordinador.id)).toBe(true);
    expect(canAssignLeadTo(coordinador, 5)).toBe(true);
    expect(canAssignLeadTo(coordinador, 6)).toBe(true);
  });

  test('coordinador NO puede asignar a alguien fuera de su equipo', () => {
    expect(canAssignLeadTo(coordinador, asesorDeOtroEquipo.id)).toBe(false);
  });

  test('coordinador puede "desasignar" (target vacío)', () => {
    expect(canAssignLeadTo(coordinador, null)).toBe(true);
    expect(canAssignLeadTo(coordinador, '')).toBe(true);
  });

  test('asesor no puede asignar a nadie', () => {
    expect(canAssignLeadTo(asesor, asesor.id)).toBe(false);
  });
});
