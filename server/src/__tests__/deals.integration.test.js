const request = require('supertest');
const app = require('../../app');
const { sequelize, Deal, Lead, Property, User } = require('../models/index');
const { createUser, authToken, createProperty, createLead, createDeal } = require('./helpers/factories');

describe('GET /api/deals', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Deal.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('pagina en vez de devolver todo el historial (AUDIT: findAll sin límite)', async () => {
    for (let i = 0; i < 15; i++) {
      const property = await createProperty();
      const lead = await createLead();
      await createDeal({ leadId: lead.id, propertyId: property.id, amount: 100000 });
    }

    const res = await authed(request(app).get('/api/deals?page=1&limit=10'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination).toEqual({ total: 15, page: 1, limit: 10, totalPages: 2 });

    const secondPage = await authed(request(app).get('/api/deals?page=2&limit=10'));
    expect(secondPage.body.data).toHaveLength(5);
  });

  test('totalAmount refleja la suma de todo el historial, no solo la página cargada', async () => {
    for (const amount of [100000, 200000, 300000]) {
      const property = await createProperty();
      const lead = await createLead();
      await createDeal({ leadId: lead.id, propertyId: property.id, amount });
    }

    const res = await authed(request(app).get('/api/deals?page=1&limit=1'));
    expect(res.body.data).toHaveLength(1);
    expect(Number(res.body.totalAmount)).toBe(600000);
  });

  test('search filtra por nombre del prospecto o título de la propiedad', async () => {
    const propertyA = await createProperty({ title: 'Casa en Misiones' });
    const leadA = await createLead({ name: 'Juan Pérez' });
    await createDeal({ leadId: leadA.id, propertyId: propertyA.id });

    const propertyB = await createProperty({ title: 'Terreno en Punta Oriente' });
    const leadB = await createLead({ name: 'María López' });
    await createDeal({ leadId: leadB.id, propertyId: propertyB.id });

    const byLeadName = await authed(request(app).get('/api/deals?search=María'));
    expect(byLeadName.body.data).toHaveLength(1);
    expect(byLeadName.body.data[0].lead.name).toBe('María López');

    const byPropertyTitle = await authed(request(app).get('/api/deals?search=Misiones'));
    expect(byPropertyTitle.body.data).toHaveLength(1);
    expect(byPropertyTitle.body.data[0].property.title).toBe('Casa en Misiones');

    // totalAmount respeta el mismo filtro de búsqueda, no el total sin filtrar
    expect(Number(byLeadName.body.totalAmount)).toBe(Number(byLeadName.body.data[0].amount));
  });

  test('sin ventas registradas, totalAmount es 0 en vez de null', async () => {
    const res = await authed(request(app).get('/api/deals'));
    expect(res.body.data).toHaveLength(0);
    expect(res.body.totalAmount).toBe(0);
  });
});
