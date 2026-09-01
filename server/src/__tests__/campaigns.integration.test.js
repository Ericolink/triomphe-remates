const request = require('supertest');
const app = require('../../app');
const { sequelize, Campaign, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

describe('POST/PUT /api/campaigns — utmCampaign (Fase 3a del rediseño del CRM)', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Campaign.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('crea una campaña con utmCampaign', async () => {
    const res = await authed(request(app).post('/api/campaigns')).send({
      platform: 'facebook',
      name: 'Remate Polanco Julio',
      startDate: '2026-07-01',
      utmCampaign: 'remate-polanco-julio',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.utmCampaign).toBe('remate-polanco-julio');
  });

  test('crea una campaña sin utmCampaign (opcional, no rompe la creación)', async () => {
    const res = await authed(request(app).post('/api/campaigns')).send({
      platform: 'google',
      name: 'Sin utm todavía',
      startDate: '2026-07-01',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.utmCampaign).toBeNull();
  });

  test('actualiza utmCampaign de una campaña existente', async () => {
    const createRes = await authed(request(app).post('/api/campaigns')).send({
      platform: 'facebook',
      name: 'Campaña a actualizar',
      startDate: '2026-07-01',
    });

    const res = await authed(request(app).put(`/api/campaigns/${createRes.body.data.id}`)).send({
      utmCampaign: 'nuevo-slug',
    });

    expect(res.status).toBe(200);
    const stored = await Campaign.findByPk(createRes.body.data.id);
    expect(stored.utmCampaign).toBe('nuevo-slug');
  });
});
