jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead } = require('../models/index');

describe('POST /api/leads', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('rechaza sin nombre/email', async () => {
    const res = await request(app).post('/api/leads').send({ phone: '6561234567' });
    expect(res.status).toBe(400);
  });

  test('rechaza email inválido', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Juan', email: 'no-es-un-email' });
    expect(res.status).toBe(400);
  });

  test('rechaza teléfono inválido (AUDIT-006)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Juan', email: 'juan@test.com', phone: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/teléfono/i);
  });

  test('crea el lead con teléfono válido en distintos formatos', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Juan Pérez', email: 'juan@test.com', phone: '+52 656 123 4567' });

    expect(res.status).toBe(201);

    const stored = await Lead.findOne({ where: { email: 'juan@test.com' } });
    expect(stored).not.toBeNull();
  });

  test('crea el lead sin teléfono (campo opcional)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Sin Teléfono', email: 'sintelefono@test.com' });

    expect(res.status).toBe(201);
  });
});
