const {
  crmAccessLevel,
  hasCrmAccess,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
} = require('../leadAccess');

const admin = { id: 1, role: 'admin', crmRole: null };
const editorNoCrm = { id: 2, role: 'editor', crmRole: null };
const coordinador = { id: 3, role: 'editor', crmRole: 'coordinador_ventas' };
const capturista = { id: 4, role: 'editor', crmRole: 'capturista' };
const asesor = { id: 5, role: 'editor', crmRole: 'asesor_ventas' };

describe('crmAccessLevel / hasCrmAccess', () => {
  test('admin siempre es "admin" sin importar crmRole', () => {
    expect(crmAccessLevel(admin)).toBe('admin');
    expect(crmAccessLevel({ role: 'admin', crmRole: 'asesor_ventas' })).toBe('admin');
  });

  test('editor sin crmRole no tiene acceso al CRM', () => {
    expect(crmAccessLevel(editorNoCrm)).toBeNull();
    expect(hasCrmAccess(editorNoCrm)).toBe(false);
  });

  test('editor con crmRole devuelve ese nivel', () => {
    expect(crmAccessLevel(coordinador)).toBe('coordinador_ventas');
    expect(crmAccessLevel(capturista)).toBe('capturista');
    expect(crmAccessLevel(asesor)).toBe('asesor_ventas');
  });

  test('sin usuario, sin acceso', () => {
    expect(crmAccessLevel(null)).toBeNull();
    expect(hasCrmAccess(null)).toBe(false);
  });
});

describe('getLeadVisibilityWhere', () => {
  test('admin y coordinador no tienen restricción (null)', () => {
    expect(getLeadVisibilityWhere(admin)).toBeNull();
    expect(getLeadVisibilityWhere(coordinador)).toBeNull();
  });

  test('capturista se restringe a createdByUserId', () => {
    expect(getLeadVisibilityWhere(capturista)).toEqual({ createdByUserId: capturista.id });
  });

  test('asesor se restringe a assignedToUserId', () => {
    expect(getLeadVisibilityWhere(asesor)).toEqual({ assignedToUserId: asesor.id });
  });

  test('usa la sintaxis $alias.campo$ cuando se pasa alias', () => {
    expect(getLeadVisibilityWhere(asesor, { alias: 'lead' })).toEqual({
      '$lead.assignedToUserId$': asesor.id,
    });
  });

  test('sin acceso, restringe a un id imposible (defensa en profundidad)', () => {
    expect(getLeadVisibilityWhere(editorNoCrm)).toEqual({ id: -1 });
  });
});

describe('canViewLead', () => {
  test('admin y coordinador ven cualquier lead', () => {
    const lead = { createdByUserId: 999, assignedToUserId: 999 };
    expect(canViewLead(admin, lead)).toBe(true);
    expect(canViewLead(coordinador, lead)).toBe(true);
  });

  test('capturista ve solo lo que creó, incluso ya asignado a otro', () => {
    expect(canViewLead(capturista, { createdByUserId: capturista.id, assignedToUserId: 99 })).toBe(
      true
    );
    expect(canViewLead(capturista, { createdByUserId: 999, assignedToUserId: null })).toBe(false);
  });

  test('asesor ve solo lo asignado a él', () => {
    expect(canViewLead(asesor, { assignedToUserId: asesor.id })).toBe(true);
    expect(canViewLead(asesor, { assignedToUserId: 999 })).toBe(false);
  });
});

describe('canEditLead', () => {
  test('admin y coordinador editan cualquier lead', () => {
    const lead = { createdByUserId: 999, assignedToUserId: 999 };
    expect(canEditLead(admin, lead)).toBe(true);
    expect(canEditLead(coordinador, lead)).toBe(true);
  });

  test('capturista edita mientras el lead no tenga responsable asignado', () => {
    expect(canEditLead(capturista, { createdByUserId: capturista.id, assignedToUserId: null })).toBe(
      true
    );
  });

  test('capturista pierde edición en cuanto se asigna un responsable, aunque siga siendo el creador', () => {
    expect(canEditLead(capturista, { createdByUserId: capturista.id, assignedToUserId: 42 })).toBe(
      false
    );
  });

  test('capturista nunca puede editar un lead que no creó', () => {
    expect(canEditLead(capturista, { createdByUserId: 999, assignedToUserId: null })).toBe(false);
  });

  test('asesor edita solo lo asignado a él', () => {
    expect(canEditLead(asesor, { assignedToUserId: asesor.id })).toBe(true);
    expect(canEditLead(asesor, { assignedToUserId: 999 })).toBe(false);
  });
});

describe('canAssignLeads', () => {
  test('solo admin y coordinador_ventas pueden asignar', () => {
    expect(canAssignLeads(admin)).toBe(true);
    expect(canAssignLeads(coordinador)).toBe(true);
    expect(canAssignLeads(capturista)).toBe(false);
    expect(canAssignLeads(asesor)).toBe(false);
    expect(canAssignLeads(editorNoCrm)).toBe(false);
  });
});
