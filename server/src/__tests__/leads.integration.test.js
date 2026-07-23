jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

describe('POST /api/leads', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  test('crea el lead sin nombre con un placeholder (campo opcional)', async () => {
    const res = await request(app).post('/api/leads').send({ phone: '6561234567' });
    expect(res.status).toBe(201);

    const stored = await Lead.findOne({ where: { phone: '6561234567' } });
    expect(stored.name).toBe('Prospecto sin nombre');
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

  test('rechaza el lead sin teléfono cuando no hay usuario autenticado (formulario público)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Sin Teléfono', email: 'sintelefono@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/teléfono/i);
  });

  test('permite el lead sin teléfono cuando lo crea un usuario autenticado (CRM, campo opcional)', async () => {
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sin Teléfono CRM' });

    expect(res.status).toBe(201);
  });

  test('rechaza un motivo de contacto fuera de la lista permitida', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ phone: '6561234567', type: 'informacion' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/i);
  });
});
