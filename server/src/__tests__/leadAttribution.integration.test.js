// Fase 3a del rediseño del CRM — atribución de marketing capturada automáticamente al
// crear un lead público, sin preguntarle nada nuevo al prospecto: utm_medium/utm_campaign/
// utm_content (leídos de la URL por ContactForm.jsx) y landingPageUrl (leído del header
// Referer por el propio backend).
jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Campaign, User } = require('../models/index');
const { createUser, authToken, createCampaign } = require('./helpers/factories');

describe('Atribución automática de marketing en POST /api/leads', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
    await Campaign.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  test('captura utm_medium/utm_campaign/utm_content tal cual se envían', async () => {
    const res = await request(app).post('/api/leads').send({
      name: 'Prospecto UTM',
      phone: '6569990101',
      utmMedium: 'cpc',
      utmCampaign: 'remate-polanco-julio',
      utmContent: 'variante-b',
    });

    expect(res.status).toBe(201);
    const stored = await Lead.findByPk(res.body.data.id);
    expect(stored.utmMedium).toBe('cpc');
    expect(stored.utmCampaign).toBe('remate-polanco-julio');
    expect(stored.utmContent).toBe('variante-b');
  });

  test('sin parámetros UTM, las columnas quedan en null (no rompe la creación del lead)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Prospecto sin UTM', phone: '6569990102' });

    expect(res.status).toBe(201);
    const stored = await Lead.findByPk(res.body.data.id);
    expect(stored.utmMedium).toBeNull();
    expect(stored.utmCampaign).toBeNull();
    expect(stored.utmContent).toBeNull();
  });

  test('landingPageUrl se captura automáticamente del header Referer, sin que el cliente lo mande', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Referer', 'https://triomphe.mx/propiedades/casa-remate-juarez')
      .send({ name: 'Prospecto con referer', phone: '6569990103' });

    expect(res.status).toBe(201);
    const stored = await Lead.findByPk(res.body.data.id);
    expect(stored.landingPageUrl).toBe('https://triomphe.mx/propiedades/casa-remate-juarez');
  });

  test('un campaignId explícito (captura manual desde el CRM) se guarda tal cual, sin depender de utm_campaign', async () => {
    const explicitCampaign = await createCampaign({ name: 'Elegida a mano' });

    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Captura manual',
        phone: '6569990106',
        campaignId: explicitCampaign.id,
        utmCampaign: 'algun-utm-campaign',
      });

    expect(res.status).toBe(201);
    const stored = await Lead.findByPk(res.body.data.id);
    expect(stored.campaignId).toBe(explicitCampaign.id);
    expect(stored.utmCampaign).toBe('algun-utm-campaign');
  });
});
