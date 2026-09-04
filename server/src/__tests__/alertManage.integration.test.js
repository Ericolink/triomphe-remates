const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const { sequelize, PropertyAlert } = require('../models/index');
const { notifyMatchingAlerts } = require('../services/alertService');

const uniquePhone = () => `6${Date.now().toString().slice(-6)}${String(Math.floor(Math.random() * 900) + 100)}`;
const uniqueEmail = (tag) => `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@triomphe.test`;

const createAlert = (overrides = {}) =>
  PropertyAlert.create({
    name: 'Cliente Test',
    email: uniqueEmail('alerta'),
    phone: uniquePhone(),
    city: 'juarez',
    type: 'casa',
    minPrice: 500000,
    maxPrice: 1500000,
    source: 'public',
    isActive: true,
    ...overrides,
  });

describe('Administración de alertas por token (/api/alerts/manage, /api/alerts/unsubscribe)', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await PropertyAlert.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('creación', () => {
    test('POST /api/alerts crea una alerta con token no-adivinable', async () => {
      const email = uniqueEmail('crear');
      const res = await request(app).post('/api/alerts').send({
        name: 'Juan Pérez',
        email,
        phone: uniquePhone(),
        city: 'juarez',
        type: 'casa',
      });

      expect(res.status).toBe(201);
      const alert = await PropertyAlert.findOne({ where: { email } });
      expect(alert).toBeTruthy();
      expect(alert.token).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('GET /api/alerts/manage', () => {
    test('con token válido devuelve los criterios actuales, sin el id de la alerta', async () => {
      const alert = await createAlert({ name: 'María López' });

      const res = await request(app).get('/api/alerts/manage').query({ token: alert.token });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        name: 'María López',
        email: alert.email,
        city: 'juarez',
        type: 'casa',
        isActive: true,
      });
      expect(res.body.data.id).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();
    });

    test('rechaza sin token', async () => {
      const res = await request(app).get('/api/alerts/manage');
      expect(res.status).toBe(400);
    });

    test('rechaza token inexistente sin revelar si el email existe', async () => {
      const alert = await createAlert({ email: uniqueEmail('secreto') });

      const res = await request(app)
        .get('/api/alerts/manage')
        .query({ token: crypto.randomBytes(32).toString('hex') });

      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain(alert.email);
    });

    test('el token de una alerta no sirve para leer otra', async () => {
      const alertA = await createAlert({ name: 'Alerta A' });
      const alertB = await createAlert({ name: 'Alerta B' });

      const res = await request(app).get('/api/alerts/manage').query({ token: alertA.token });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Alerta A');
      expect(res.body.data.name).not.toBe(alertB.name);
    });

    test('cambiar el id de la alerta (no el token) no da acceso — no existe endpoint por id', async () => {
      const alert = await createAlert();
      const res = await request(app).get('/api/alerts/manage').query({ token: String(alert.id) });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/alerts/manage', () => {
    test('actualiza la alerta existente sin crear una segunda ni cambiar el token/id', async () => {
      const alert = await createAlert({ name: 'Nombre Viejo', city: 'juarez' });
      const countBefore = await PropertyAlert.count();

      const res = await request(app).put('/api/alerts/manage').query({ token: alert.token }).send({
        name: 'Nombre Nuevo',
        phone: uniquePhone(),
        city: 'chihuahua',
        type: 'departamento',
        minPrice: '600000',
        maxPrice: '2000000',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Nombre Nuevo');
      expect(res.body.data.city).toBe('chihuahua');

      const countAfter = await PropertyAlert.count();
      expect(countAfter).toBe(countBefore);

      await alert.reload();
      expect(alert.id).toBe(alert.id);
      expect(alert.token).toBe(alert.token);
      expect(alert.name).toBe('Nombre Nuevo');
      expect(alert.city).toBe('chihuahua');
      expect(Number(alert.minPrice)).toBe(600000);
    });

    test('rechaza sin token', async () => {
      const res = await request(app).put('/api/alerts/manage').send({ name: 'X', phone: uniquePhone() });
      expect(res.status).toBe(400);
    });

    test('rechaza token inválido', async () => {
      const res = await request(app)
        .put('/api/alerts/manage')
        .query({ token: crypto.randomBytes(32).toString('hex') })
        .send({ name: 'X', phone: uniquePhone() });
      expect(res.status).toBe(404);
    });

    test('el token de una alerta no puede modificar otra', async () => {
      const alertA = await createAlert({ name: 'Original A' });
      const alertB = await createAlert({ name: 'Original B' });

      await request(app)
        .put('/api/alerts/manage')
        .query({ token: alertA.token })
        .send({ name: 'Hackeado', phone: uniquePhone() });

      await alertB.reload();
      expect(alertB.name).toBe('Original B');
    });

    test('valida criterios inválidos: sin nombre', async () => {
      const alert = await createAlert();
      const res = await request(app)
        .put('/api/alerts/manage')
        .query({ token: alert.token })
        .send({ name: '', phone: uniquePhone() });
      expect(res.status).toBe(400);
    });

    test('valida criterios inválidos: teléfono inválido', async () => {
      const alert = await createAlert();
      const res = await request(app)
        .put('/api/alerts/manage')
        .query({ token: alert.token })
        .send({ name: 'X', phone: '123' });
      expect(res.status).toBe(400);
    });

    test('valida criterios inválidos: ciudad fuera del catálogo', async () => {
      const alert = await createAlert();
      const res = await request(app)
        .put('/api/alerts/manage')
        .query({ token: alert.token })
        .send({ name: 'X', phone: uniquePhone(), city: 'ciudad-inventada' });
      expect(res.status).toBe(400);
    });
  });

  describe('cancelación (GET /api/alerts/unsubscribe) y su efecto sobre manage', () => {
    test('cancela la alerta (soft-delete, no la elimina)', async () => {
      const alert = await createAlert();

      const res = await request(app).get('/api/alerts/unsubscribe').query({ token: alert.token });
      expect(res.status).toBe(200);

      await alert.reload();
      expect(alert.isActive).toBe(false);
      const stillExists = await PropertyAlert.findByPk(alert.id);
      expect(stillExists).toBeTruthy();
    });

    test('cancelar dos veces es idempotente (no produce error)', async () => {
      const alert = await createAlert();

      const first = await request(app).get('/api/alerts/unsubscribe').query({ token: alert.token });
      const second = await request(app).get('/api/alerts/unsubscribe').query({ token: alert.token });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      await alert.reload();
      expect(alert.isActive).toBe(false);
    });

    test('una alerta cancelada ya no debe ser procesada por el motor de matching', async () => {
      const alert = await createAlert({ city: 'juarez', type: 'casa' });
      await request(app).get('/api/alerts/unsubscribe').query({ token: alert.token });

      const matching = await notifyMatchingAlerts({ city: 'juarez', type: 'casa', price: 900000 });
      expect(matching.map((a) => a.id)).not.toContain(alert.id);
    });

    test('GET /api/alerts/manage tras cancelar sigue respondiendo con isActive:false', async () => {
      const alert = await createAlert();
      await request(app).get('/api/alerts/unsubscribe').query({ token: alert.token });

      const res = await request(app).get('/api/alerts/manage').query({ token: alert.token });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    test('PUT /api/alerts/manage rechaza modificar una alerta ya cancelada', async () => {
      const alert = await createAlert();
      await request(app).get('/api/alerts/unsubscribe').query({ token: alert.token });

      const res = await request(app)
        .put('/api/alerts/manage')
        .query({ token: alert.token })
        .send({ name: 'Intento tardío', phone: uniquePhone() });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALERT_INACTIVE');

      await alert.reload();
      expect(alert.name).not.toBe('Intento tardío');
    });
  });
});
