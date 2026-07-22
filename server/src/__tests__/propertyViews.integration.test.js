const request = require('supertest');
const app = require('../../app');
const { sequelize, Property, Analytics, User } = require('../models/index');
const { createUser, authToken, createProperty } = require('./helpers/factories');

// Regresión: getPropertyById (admin, PropertyFormPage) y getPropertyBySlug (ficha pública)
// alguna vez incrementaban `views` en el propio GET. Abrir una propiedad para editarla
// contaminaba el ranking de "más vistas". El registro de vistas ahora vive únicamente en
// POST /:id/view, disparado por el cliente solo en el render real de la ficha pública.
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
    expect(await Analytics.count({ where: { propertyId: property.id, event: 'view' } })).toBe(0);
  });

  test('GET /api/properties/slug/:slug (ficha pública) tampoco incrementa views por sí solo', async () => {
    const property = await createProperty({ slug: `prop-view-test-${Date.now()}` });

    const res = await request(app).get(`/api/properties/slug/${property.slug}`);
    expect(res.status).toBe(200);

    await property.reload();
    expect(property.views).toBe(0);
    expect(await Analytics.count({ where: { propertyId: property.id, event: 'view' } })).toBe(0);
  });

  test('POST /api/properties/:id/view registra la visita e incrementa views', async () => {
    const property = await createProperty();

    const res = await request(app).post(`/api/properties/${property.id}/view`);
    expect(res.status).toBe(204);

    await property.reload();
    expect(property.views).toBe(1);

    const events = await Analytics.findAll({ where: { propertyId: property.id, event: 'view' } });
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
    await request(app).post(`/api/properties/${property.id}/view`);
    await property.reload();
    expect(property.views).toBe(1);
  });
});
