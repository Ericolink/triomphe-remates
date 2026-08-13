const {
  crmAccessLevel,
  hasCrmAccess,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
} = require('../leadAccess');

const admin = { id: 1, role: 'admin' };
const coordinador = { id: 2, role: 'coordinador_ventas' };
const asistente = { id: 3, role: 'asistente_administrativo' };
const asesor = { id: 4, role: 'asesor_ventas' };

describe('crmAccessLevel / hasCrmAccess', () => {
  test('admin siempre es "admin"', () => {
    expect(crmAccessLevel(admin)).toBe('admin');
  });

  test('coordinador_ventas no tiene acceso al CRM de leads (solo inventario)', () => {
    expect(crmAccessLevel(coordinador)).toBeNull();
    expect(hasCrmAccess(coordinador)).toBe(false);
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

  test('sin acceso (coordinador_ventas), restringe a un id imposible (defensa en profundidad)', () => {
    expect(getLeadVisibilityWhere(coordinador)).toEqual({ id: -1 });
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

  test('coordinador_ventas no ve ningún lead', () => {
    expect(canViewLead(coordinador, { assignedToUserId: 999 })).toBe(false);
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
});

describe('canAssignLeads', () => {
  test('solo admin y asistente_administrativo pueden asignar', () => {
    expect(canAssignLeads(admin)).toBe(true);
    expect(canAssignLeads(asistente)).toBe(true);
    expect(canAssignLeads(coordinador)).toBe(false);
    expect(canAssignLeads(asesor)).toBe(false);
  });
});
