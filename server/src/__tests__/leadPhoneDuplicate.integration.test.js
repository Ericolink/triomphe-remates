// DB-001 — la comprobación de teléfono duplicado (findDuplicatePhoneLead) hacía un
// full-table-scan comparando en JavaScript, y el chequeo "existe/no existe" ocurría por
// fuera de cualquier transacción/lock — dos creaciones casi simultáneas del mismo teléfono
// podían pasarlo ambas. Ahora usa un lookup indexado sobre `phoneNormalized` (columna
// mantenida por un hook, ver models/Lead.js) que además tiene un índice ÚNICO en la base de
// datos: el respaldo real contra la condición de carrera. Estos tests verifican que la
// detección por formato distinto sigue funcionando igual que antes, y que la carrera real
// (dos requests concurrentes) deja pasar exactamente uno.
jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, User } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

describe('Detección de teléfono duplicado (DB-001)', () => {
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

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('rechaza un teléfono duplicado aunque se escriba en un formato distinto (guiones/+52/espacios)', async () => {
    const first = await request(app).post('/api/leads').send({ name: 'Uno', phone: '6569990001' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/leads')
      .send({ name: 'Dos', phone: '+52 656-999-0001' });

    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/ya existe un prospecto/i);
    // Contar por teléfono normalizado, no la tabla completa — otros archivos de test
    // corriendo en la misma base de datos de test pueden tener sus propios leads vivos en
    // el momento exacto en que corre este assert.
    expect(await Lead.count({ where: { phoneNormalized: '6569990001' } })).toBe(1);
  });

  test('permite guardar un lead con el mismo teléfono que ya tenía (no se autobloquea)', async () => {
    const createRes = await request(app)
      .post('/api/leads')
      .send({ name: 'Prospecto', phone: '6569990002' });
    const leadId = createRes.body.data.id;

    const res = await authed(request(app).put(`/api/leads/${leadId}`)).send({
      phone: '656-999-0002', // mismo número, formato distinto
      name: 'Prospecto Actualizado',
    });

    expect(res.status).toBe(200);
    const stored = await Lead.findByPk(leadId);
    expect(stored.name).toBe('Prospecto Actualizado');
  });

  test('rechaza actualizar un lead con el teléfono de OTRO lead existente', async () => {
    await request(app).post('/api/leads').send({ name: 'A', phone: '6569990003' });
    const leadB = await request(app).post('/api/leads').send({ name: 'B', phone: '6569990004' });

    const res = await authed(request(app).put(`/api/leads/${leadB.body.data.id}`)).send({
      phone: '6569990003',
    });

    expect(res.status).toBe(409);
    const stored = await Lead.findByPk(leadB.body.data.id);
    expect(stored.phone).toBe('6569990004'); // no se modificó
  });

  test('concurrencia: dos creaciones simultáneas con el mismo teléfono — solo una tiene éxito, la otra recibe un 409 limpio (no un 500)', async () => {
    const phone = '6569990005';

    const [resA, resB] = await Promise.all([
      request(app).post('/api/leads').send({ name: 'Concurrente A', phone }),
      request(app).post('/api/leads').send({ name: 'Concurrente B', phone }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
    const winner = resA.status === 201 ? resA : resB;
    const loser = resA.status === 201 ? resB : resA;
    expect(loser.body.error).toMatch(/ya existe un prospecto/i);

    const leads = await Lead.findAll({ where: { phone } });
    expect(leads).toHaveLength(1);
    expect(leads[0].id).toBe(winner.body.data.id);
  });
});
