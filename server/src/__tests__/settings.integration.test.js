const request = require('supertest');
const app = require('../../app');
const { sequelize, Setting } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');
const { getSetting, INVENTORY_DOWNLOAD_ENABLED_KEY } = require('../services/settingsService');

describe('GET/PUT /api/settings/inventory-download', () => {
  let admin, adminToken, asesor, asesorToken, coordinador, coordinadorToken, asistente, asistenteToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    adminToken = authToken(admin);
    asesor = await createUser({ role: 'asesor_ventas' });
    asesorToken = authToken(asesor);
    coordinador = await createUser({ role: 'coordinador_ventas' });
    coordinadorToken = authToken(coordinador);
    asistente = await createUser({ role: 'asistente_administrativo' });
    asistenteToken = authToken(asistente);
  });

  afterEach(async () => {
    // Deja el flag en su valor por default para no filtrar estado entre archivos de test
    // que dependan del comportamiento actual de exportCatalogPDF.
    await Setting.upsert({ key: INVENTORY_DOWNLOAD_ENABLED_KEY, value: JSON.stringify(true) });
  });

  afterAll(async () => {
    await Promise.all(
      [admin, asesor, coordinador, asistente].map((u) => u && u.destroy({ force: true }))
    );
    await sequelize.close();
  });

  const authed = (req, token) => req.set('Authorization', `Bearer ${token}`);

  describe('permisos', () => {
    test('sin token, GET responde 401', async () => {
      const res = await request(app).get('/api/settings/inventory-download');
      expect(res.status).toBe(401);
    });

    test('sin token, PUT responde 401', async () => {
      const res = await request(app).put('/api/settings/inventory-download').send({ enabled: false });
      expect(res.status).toBe(401);
    });

    test.each([
      ['asesor_ventas', () => asesorToken],
      ['coordinador_ventas', () => coordinadorToken],
      ['asistente_administrativo', () => asistenteToken],
    ])('%s recibe 403 al intentar modificar la configuración', async (_role, getToken) => {
      const res = await authed(
        request(app).put('/api/settings/inventory-download'),
        getToken()
      ).send({ enabled: false });
      expect(res.status).toBe(403);
    });

    test('un rol sin acceso admin también recibe 403 al leerla (no solo al escribirla)', async () => {
      const res = await authed(request(app).get('/api/settings/inventory-download'), asesorToken);
      expect(res.status).toBe(403);
    });

    test('admin puede leer la configuración', async () => {
      const res = await authed(request(app).get('/api/settings/inventory-download'), adminToken);
      expect(res.status).toBe(200);
      expect(typeof res.body.enabled).toBe('boolean');
    });

    test('admin puede modificar la configuración', async () => {
      const res = await authed(
        request(app).put('/api/settings/inventory-download'),
        adminToken
      ).send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(false);
    });
  });

  describe('validación', () => {
    test('rechaza un valor no booleano con 400', async () => {
      const res = await authed(
        request(app).put('/api/settings/inventory-download'),
        adminToken
      ).send({ enabled: 'no' });
      expect(res.status).toBe(400);
    });
  });

  describe('persistencia', () => {
    test('el valor persiste entre requests distintos (no es solo memoria del proceso)', async () => {
      await authed(request(app).put('/api/settings/inventory-download'), adminToken).send({
        enabled: false,
      });

      const stored = await getSetting(INVENTORY_DOWNLOAD_ENABLED_KEY);
      expect(stored).toBe(false);

      const res = await authed(request(app).get('/api/settings/inventory-download'), adminToken);
      expect(res.body.enabled).toBe(false);

      await authed(request(app).put('/api/settings/inventory-download'), adminToken).send({
        enabled: true,
      });
      const res2 = await authed(request(app).get('/api/settings/inventory-download'), adminToken);
      expect(res2.body.enabled).toBe(true);
    });
  });
});
