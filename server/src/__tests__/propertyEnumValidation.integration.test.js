// AUDITORÍA 500s (2026-09-01): a diferencia de Lead (ver AUDIT-024 en leadController.js),
// Property nunca validaba sus 7 columnas ENUM antes de esta auditoría — un valor inválido
// (ej. un bundle de frontend desactualizado tras un deploy que renombró un ENUM, como pasó
// con `category` en 2026-07-23) caía directo a Sequelize/MySQL y volvía como un
// SequelizeDatabaseError/SequelizeValidationError crudo → 500 "Error interno del servidor".
// Estos tests cubren tanto el 400 específico (propertyController.validatePropertyEnums)
// como la red de seguridad genérica (errorHandler.translateKnownError) para el caso en que
// algún ENUM se quede sin whitelist explícita en el futuro.
const request = require('supertest');
const app = require('../../app');
const { sequelize, Property, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

describe('Validación de ENUMs de Property (creación/edición)', () => {
  let admin, adminToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    adminToken = authToken(admin);
  });

  afterEach(async () => {
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const basePayload = () => ({
    title: 'Casa de prueba',
    city: 'juarez',
    type: 'casa',
  });

  describe('POST /api/properties', () => {
    test('caso exitoso: crea la propiedad con valores válidos', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...basePayload(), category: 'remate', businessLine: 'remate', status: 'disponible' });

      expect(res.status).toBe(201);
      expect(res.body.data.category).toBe('remate');
    });

    test.each([
      ['city', 'marte'],
      ['type', 'castillo'],
      ['category', 'no_existe'],
      ['businessLine', 'no_existe'],
      ['status', 'no_existe'],
      ['acquisitionStage', 'no_existe'],
      ['legalProcessType', 'no_existe'],
    ])('rechaza un %s inválido con 400 (nunca 500)', async (field, invalidValue) => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...basePayload(), [field]: invalidValue });

      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.any(String));
      expect(res.body.error).not.toMatch(/error interno del servidor/i);

      // Nada debió quedar creado a medias.
      const count = await Property.count();
      expect(count).toBe(0);
    });
  });

  describe('PUT /api/properties/:id', () => {
    test('rechaza un category inválido en edición con 400 (nunca 500)', async () => {
      const property = await createProperty({ category: 'remate' });

      const res = await request(app)
        .put(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'no_existe' });

      expect(res.status).toBe(400);

      const unchanged = await Property.findByPk(property.id);
      expect(unchanged.category).toBe('remate');
    });

    test('caso exitoso: edición parcial sin tocar los ENUMs no requiere validarlos', async () => {
      const property = await createProperty({ title: 'Antes' });

      const res = await request(app)
        .put(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Después' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Después');
    });
  });
});
