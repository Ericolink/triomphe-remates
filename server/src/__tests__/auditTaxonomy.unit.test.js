const { AREAS, AREA_LIST, KNOWN_RESOURCES, classifyAuditEvent, resourcesForArea, searchableLabelMatches } =
  require('../constants/auditTaxonomy');

describe('auditTaxonomy', () => {
  test('AREA_LIST expone exactamente las 9 áreas pedidas por el rediseño', () => {
    expect(AREA_LIST.sort()).toEqual(
      [
        'CRM',
        'Propiedades',
        'Usuarios',
        'Autenticación',
        'Marketing',
        'Configuración',
        'Analytics',
        'Seguridad',
        'Sistema',
      ].sort()
    );
  });

  test.each(KNOWN_RESOURCES)('cada resource conocido ("%s") clasifica create/update/delete de forma bien formada', (resource) => {
    for (const action of ['create', 'update', 'delete']) {
      const result = classifyAuditEvent({ action, resource, resourceId: 1, detail: null, result: 'success' });
      expect(result.area).toEqual(expect.any(String));
      expect(result.subarea).toEqual(expect.any(String));
      expect(result.label).toEqual(expect.any(String));
      expect(result.icon).toEqual(expect.any(String));
      expect(typeof result.critical).toBe('boolean');
      expect(AREA_LIST).toContain(result.area);
    }
  });

  test('cualquier delete se marca crítico, sin importar el resource', () => {
    for (const resource of KNOWN_RESOURCES) {
      expect(classifyAuditEvent({ action: 'delete', resource, resourceId: 1, detail: null, result: 'success' }).critical).toBe(true);
    }
  });

  test('crear/editar/eliminar un usuario siempre es crítico', () => {
    for (const action of ['create', 'update', 'delete']) {
      expect(classifyAuditEvent({ action, resource: 'user', resourceId: 1, detail: null, result: 'success' }).critical).toBe(true);
    }
  });

  test('editar un usuario SIN cambiar el rol no se reclasifica como Permisos', () => {
    const result = classifyAuditEvent({
      action: 'update',
      resource: 'user',
      resourceId: 1,
      detail: { changes: [{ field: 'name', before: 'A', after: 'B' }] },
      result: 'success',
    });
    expect(result.subarea).toBe('Cuentas');
  });

  test('editar un usuario cambiando el rol se reclasifica como Usuarios · Permisos', () => {
    const result = classifyAuditEvent({
      action: 'update',
      resource: 'user',
      resourceId: 1,
      detail: { changes: [{ field: 'role', before: 'asesor_ventas', after: 'admin' }] },
      result: 'success',
    });
    expect(result.area).toBe(AREAS.USUARIOS);
    expect(result.subarea).toBe('Permisos');
    expect(result.critical).toBe(true);
  });

  test('un login exitoso clasifica como Autenticación · Acceso', () => {
    const result = classifyAuditEvent({ action: 'login', resource: 'user', resourceId: 1, detail: null, result: 'success' });
    expect(result.area).toBe(AREAS.AUTENTICACION);
    expect(result.subarea).toBe('Acceso');
    expect(result.critical).toBe(false);
  });

  test('un login fallido clasifica como Seguridad · Accesos fallidos y es crítico', () => {
    const result = classifyAuditEvent({ action: 'login', resource: 'user', resourceId: null, detail: null, result: 'failed' });
    expect(result.area).toBe(AREAS.SEGURIDAD);
    expect(result.subarea).toBe('Accesos fallidos');
    expect(result.critical).toBe(true);
  });

  test('resourcesForArea(Propiedades) incluye "property"', () => {
    expect(resourcesForArea(AREAS.PROPIEDADES)).toContain('property');
  });

  test('searchableLabelMatches encuentra "editar prospecto" → update/lead', () => {
    const matches = searchableLabelMatches('editar prospecto');
    expect(matches).toEqual(expect.arrayContaining([{ action: 'update', resource: 'lead' }]));
  });

  test('searchableLabelMatches con término vacío no rompe', () => {
    expect(searchableLabelMatches('   ')).toEqual([]);
  });
});
