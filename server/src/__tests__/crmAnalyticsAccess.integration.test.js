// SEC-001 / SEC-002 — GET /api/crm/dashboard y GET /api/crm/reports agregan datos sin
// filtrar por fila (PII de citas/actividad reciente ajena, ingresos y desempeño de toda
// la empresa). En vez de scoping parcial de cada sub-consulta, la ruta ahora se restringe
// a los mismos roles que ya tienen `hasBackofficeAccess` en el frontend — estos tests
// verifican que esa restricción realmente se aplica (no solo que el endpoint "responde").
const request = require('supertest');
const app = require('../../app');
const { sequelize, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

describe('Control de acceso de GET /api/crm/dashboard y GET /api/crm/reports', () => {
  let admin, asistente, asesor, coordinador;
  let adminToken, asistenteToken, asesorToken, coordinadorToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asistente = await createUser({ role: 'asistente_administrativo' });
    asesor = await createUser({ role: 'asesor_ventas' });
    coordinador = await createUser({ role: 'coordinador_ventas' });
    adminToken = authToken(admin);
    asistenteToken = authToken(asistente);
    asesorToken = authToken(asesor);
    coordinadorToken = authToken(coordinador);
  });

  afterAll(async () => {
    await User.destroy({
      where: { id: [admin.id, asistente.id, asesor.id, coordinador.id] },
      force: true,
    });
    await sequelize.close();
  });

  describe.each([['/api/crm/dashboard'], ['/api/crm/reports']])('%s', (path) => {
    test('caso permitido: admin recibe los datos agregados', async () => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    test('caso permitido: asistente_administrativo recibe los datos agregados', async () => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${asistenteToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    test('caso bloqueado: asesor_ventas recibe 403 y ningún dato', async () => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${asesorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
    });

    test('caso bloqueado: coordinador_ventas recibe 403 y ningún dato', async () => {
      const res = await request(app).get(path).set('Authorization', `Bearer ${coordinadorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.data).toBeUndefined();
    });

    test('caso bloqueado: sin token recibe 401 y ningún dato', async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.data).toBeUndefined();
    });

    test('caso bloqueado: token de sesión inválida (rol desconocido) recibe 403/401, nunca 200', async () => {
      const res = await request(app).get(path).set('Authorization', 'Bearer token-invalido');
      expect([401, 403]).toContain(res.status);
      expect(res.body.data).toBeUndefined();
    });
  });
});
