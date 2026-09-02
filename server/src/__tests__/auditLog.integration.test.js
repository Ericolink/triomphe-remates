const request = require('supertest');
const { Op } = require('sequelize');
const app = require('../../app');
const { sequelize, AuditLog, Property, Testimonial } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

async function waitForAuditLog(where, { retries = 10, delayMs = 20 } = {}) {
  for (let i = 0; i < retries; i++) {
    const row = await AuditLog.findOne({ where, order: [['id', 'DESC']] });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

describe('GET /api/audit', () => {
  let admin, adminToken, asesor, asesorToken, coordinador, coordinadorToken, asistente, asistenteToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin', name: 'Admin Auditoría' });
    adminToken = authToken(admin);
    asesor = await createUser({ role: 'asesor_ventas' });
    asesorToken = authToken(asesor);
    coordinador = await createUser({ role: 'coordinador_ventas' });
    coordinadorToken = authToken(coordinador);
    asistente = await createUser({ role: 'asistente_administrativo' });
    asistenteToken = authToken(asistente);
  });

  afterAll(async () => {
    await AuditLog.destroy({ where: {}, force: true });
    await Testimonial.destroy({ where: { clientName: 'Cliente de prueba' }, force: true });
    await Property.destroy({ where: { title: { [Op.like]: 'Casa Auditoría%' } }, force: true });
    await Promise.all(
      [admin, asesor, coordinador, asistente].map((u) => u && u.destroy({ force: true }))
    );
    await sequelize.close();
  });

  const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);

  describe('permisos', () => {
    test.each([
      ['asesor_ventas', () => asesorToken],
      ['coordinador_ventas', () => coordinadorToken],
      ['asistente_administrativo', () => asistenteToken],
    ])('%s recibe 403 y ningún dato', async (_role, getToken) => {
      const res = await authed(request(app).get('/api/audit'), getToken());
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
    });

    test('sin token responde 401', async () => {
      const res = await request(app).get('/api/audit');
      expect(res.status).toBe(401);
    });

    test('admin puede listar', async () => {
      const res = await authed(request(app).get('/api/audit'), adminToken);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('filtros y búsqueda', () => {
    let property;

    beforeAll(async () => {
      await AuditLog.destroy({ where: {}, force: true });
      property = await createProperty({ title: 'Casa Auditoría Uno' });

      // Genera eventos reales pasando por el flujo normal en vez de insertar filas a mano
      // — así también se ejercitan logAudit/buildChanges/taxonomía end-to-end.
      await authed(request(app).put(`/api/properties/${property.id}`), adminToken).send({
        title: 'Casa Auditoría Uno Editada',
        price: 999000,
      });
      await waitForAuditLog({ resource: 'property', resourceId: property.id, action: 'update' });

      // Login fallido — genera un evento de Seguridad con result:'failed'.
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'no-existe-audit-test@triomphe.test', password: 'wrong' });
      await waitForAuditLog({ action: 'login', result: 'failed' });
    });

    test('filtra por resource', async () => {
      const res = await authed(request(app).get('/api/audit').query({ resource: 'property' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.every((log) => log.resource === 'property')).toBe(true);
    });

    test('filtra por action', async () => {
      const res = await authed(request(app).get('/api/audit').query({ action: 'login' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.every((log) => log.action === 'login')).toBe(true);
    });

    test('filtra por result', async () => {
      const res = await authed(request(app).get('/api/audit').query({ result: 'failed' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((log) => log.result === 'failed')).toBe(true);
    });

    test('filtra por área "Seguridad" — solo logins fallidos', async () => {
      const res = await authed(request(app).get('/api/audit').query({ area: 'Seguridad' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((log) => log.action === 'login' && log.result === 'failed')).toBe(true);
      expect(res.body.data.every((log) => log.area === 'Seguridad')).toBe(true);
    });

    test('filtra por rango de fecha "hoy"', async () => {
      const res = await authed(request(app).get('/api/audit').query({ range: 'hoy' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    test('un área sin eventos hoy (Configuración) devuelve una lista vacía, no un error', async () => {
      const res = await authed(request(app).get('/api/audit').query({ area: 'Configuración' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    test('búsqueda por resourceId numérico encuentra el evento de la propiedad', async () => {
      const res = await authed(request(app).get('/api/audit').query({ q: String(property.id) }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.some((log) => log.resource === 'property' && log.resourceId === property.id)).toBe(true);
    });

    test('búsqueda por etiqueta humana ("editar propiedad") encuentra el update aunque nunca se guarde ese texto', async () => {
      const res = await authed(
        request(app).get('/api/audit').query({ q: 'editar propiedad' }),
        adminToken
      );
      expect(res.status).toBe(200);
      expect(res.body.data.some((log) => log.action === 'update' && log.resource === 'property')).toBe(true);
    });

    test('búsqueda por nombre de usuario (FULLTEXT/LIKE sobre userName)', async () => {
      const res = await authed(request(app).get('/api/audit').query({ q: 'Auditoría' }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.data.some((log) => log.userName === 'Admin Auditoría')).toBe(true);
    });

    test('cada evento devuelto trae la clasificación de la taxonomía', async () => {
      const res = await authed(request(app).get('/api/audit').query({ resource: 'property' }), adminToken);
      const row = res.body.data[0];
      expect(row.area).toBe('Propiedades');
      expect(row.subarea).toBeDefined();
      expect(row.label).toBeDefined();
      expect(typeof row.critical).toBe('boolean');
    });

    test('el update de propiedad trae el detalle de cambios (before/after)', async () => {
      const res = await authed(
        request(app).get('/api/audit').query({ resource: 'property', action: 'update' }),
        adminToken
      );
      const row = res.body.data.find((log) => log.resourceId === property.id);
      expect(row.detail.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title', after: 'Casa Auditoría Uno Editada' }),
        ])
      );
    });
  });

  describe('paginación', () => {
    test('respeta el límite máximo y trae metadata de paginación', async () => {
      const res = await authed(request(app).get('/api/audit').query({ limit: 200 }), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
      expect(res.body.pagination).toEqual(
        expect.objectContaining({ total: expect.any(Number), page: expect.any(Number) })
      );
    });
  });

  describe('compatibilidad con filas históricas', () => {
    test('una fila sin result/detail (forma pre-rediseño) se clasifica y sirve sin romper', async () => {
      const legacyUser = await createUser({ role: 'admin', name: 'Usuario Legacy' });
      const legacy = await AuditLog.create({
        userId: legacyUser.id,
        userEmail: legacyUser.email,
        userName: legacyUser.name,
        action: 'update',
        resource: 'lead',
        resourceId: 12345,
        detail: null,
        ip: null,
        // result usa su propio DEFAULT ('success') igual que cualquier fila migrada.
      });

      const res = await authed(request(app).get('/api/audit').query({ resource: 'lead' }), adminToken);
      const row = res.body.data.find((log) => log.id === legacy.id);
      expect(row).toBeDefined();
      expect(row.result).toBe('success');
      expect(row.area).toBe('CRM');
      expect(row.detail).toBeNull();

      await legacyUser.destroy({ force: true });
    });
  });

  describe('GET /api/audit/summary', () => {
    test('devuelve total/today/activeUsersToday/criticalToday coherentes', async () => {
      const res = await authed(request(app).get('/api/audit/summary'), adminToken);
      expect(res.status).toBe(200);
      const { total, today, activeUsersToday, criticalToday } = res.body.data;
      expect(total).toBeGreaterThanOrEqual(today);
      expect(today).toBeGreaterThanOrEqual(activeUsersToday);
      expect(today).toBeGreaterThanOrEqual(criticalToday);
    });

    test('un login fallido cuenta como evento crítico de hoy', async () => {
      const res = await authed(
        request(app).get('/api/audit/summary').query({ area: 'Seguridad' }),
        adminToken
      );
      expect(res.body.data.criticalToday).toBeGreaterThan(0);
    });

    test('activeUsersTodayList trae los usuarios reales detrás del número, no solo el conteo', async () => {
      const res = await authed(request(app).get('/api/audit/summary'), adminToken);
      const { activeUsersToday, activeUsersTodayList } = res.body.data;
      expect(activeUsersTodayList).toHaveLength(activeUsersToday);
      expect(activeUsersTodayList.some((u) => u.name === 'Admin Auditoría')).toBe(true);
      expect(activeUsersTodayList[0]).toEqual(expect.objectContaining({ id: expect.any(Number), name: expect.any(String) }));
    });
  });

  describe('filtro ?critical=true', () => {
    test('trae solo eventos críticos y coincide con el conteo de criticalToday', async () => {
      const summaryRes = await authed(
        request(app).get('/api/audit/summary').query({ range: 'hoy' }),
        adminToken
      );
      const listRes = await authed(
        request(app).get('/api/audit').query({ critical: 'true', range: 'hoy', limit: 100 }),
        adminToken
      );
      expect(listRes.status).toBe(200);
      expect(listRes.body.data.every((log) => log.critical)).toBe(true);
      expect(listRes.body.pagination.total).toBe(summaryRes.body.data.criticalToday);
    });

    test('un login exitoso nunca aparece bajo ?critical=true', async () => {
      const res = await authed(
        request(app).get('/api/audit').query({ critical: 'true', action: 'login', result: 'success', limit: 50 }),
        adminToken
      );
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('regresión: testimonial ya no se pierde por el bug del ENUM', () => {
    test('crear un testimonio escribe una fila real en audit_logs (antes fallaba en silencio)', async () => {
      const res = await authed(request(app).post('/api/testimonials'), adminToken).send({
        clientName: 'Cliente de prueba',
        testimonialText: 'Excelente servicio',
      });
      expect(res.status).toBe(201);

      const auditRow = await waitForAuditLog({ resource: 'testimonial', resourceId: res.body.data.id });
      expect(auditRow).not.toBeNull();
      expect(auditRow.action).toBe('create');
    });
  });

  describe('seguridad: sin secretos en detail', () => {
    test('un login fallido nunca guarda la contraseña intentada', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'redaction-test@triomphe.test', password: 'super-secreta-123' });

      const row = await waitForAuditLog({ action: 'login', result: 'failed' });
      expect(row).not.toBeNull();
      expect(row.detail).not.toContain('super-secreta-123');
    });
  });
});
