const request = require('supertest');
const app = require('../../app');
const { sequelize, Property, Analytics, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

// Un User-Agent ausente se trata como bot (ver botDetection.js — ningún navegador real omite
// esta cabecera), y supertest no manda una por default. Se simula un navegador real para que
// estos tests reflejen una visita real y no queden marcados isBot=true.
const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Regresión: getPropertyById (admin, PropertyFormPage) y getPropertyBySlug (ficha pública)
// alguna vez incrementaban `views` en el propio GET. Abrir una propiedad para editarla
// contaminaba el ranking de "más vistas". El registro de vistas ahora vive únicamente en
// POST /:id/view, disparado por el cliente solo en el render real de la ficha pública.
// Desde la Fase 1 de analítica de tráfico, ese endpoint delega en
// analyticsService.recordEvent con event='property_view' (antes 'view', ver migración
// 20260903000002) — mismo endpoint, misma respuesta 204, cobertura de deduplicación/bots
// ver analyticsEvents.integration.test.js.
describe('Registro de vistas de propiedades', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Analytics.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  test('GET /api/properties/:id (panel admin) no incrementa views ni crea Analytics', async () => {
    const property = await createProperty();

    const res = await request(app)
      .get(`/api/properties/${property.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    await property.reload();
    expect(property.views).toBe(0);
    expect(await Analytics.count({ where: { propertyId: property.id, event: 'property_view' } })).toBe(0);
  });

  test('GET /api/properties/slug/:slug (ficha pública) tampoco incrementa views por sí solo', async () => {
    const property = await createProperty({ slug: `prop-view-test-${Date.now()}` });

    const res = await request(app).get(`/api/properties/slug/${property.slug}`);
    expect(res.status).toBe(200);

    await property.reload();
    expect(property.views).toBe(0);
    expect(await Analytics.count({ where: { propertyId: property.id, event: 'property_view' } })).toBe(0);
  });

  test('POST /api/properties/:id/view registra la visita e incrementa views', async () => {
    const property = await createProperty();

    const res = await request(app)
      .post(`/api/properties/${property.id}/view`)
      .set('User-Agent', REAL_BROWSER_UA);
    expect(res.status).toBe(204);

    await property.reload();
    expect(property.views).toBe(1);

    const events = await Analytics.findAll({ where: { propertyId: property.id, event: 'property_view' } });
    expect(events).toHaveLength(1);
  });

  test('múltiples aperturas desde el panel admin no alteran el ranking de más vistas', async () => {
    const property = await createProperty();

    for (let i = 0; i < 5; i++) {
      await request(app)
        .get(`/api/properties/${property.id}`)
        .set('Authorization', `Bearer ${token}`);
    }

    await property.reload();
    expect(property.views).toBe(0);

    // Y sigue subiendo solo cuando un visitante real dispara el endpoint dedicado.
    await request(app).post(`/api/properties/${property.id}/view`).set('User-Agent', REAL_BROWSER_UA);
    await property.reload();
    expect(property.views).toBe(1);
  });
});
