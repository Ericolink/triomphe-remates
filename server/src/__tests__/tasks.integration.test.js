const request = require('supertest');
const app = require('../../app');
const { sequelize, Task, Lead, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('GET /api/tasks — pagina por contrato cuando no hay leadIds (AUDIT: antes findAll no tenía tope)', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Task.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  const seedOverdueTasks = async (count) => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (let i = 0; i < count; i++) {
      const lead = await createLead();
      await Task.create({
        leadId: lead.id,
        type: 'dar_seguimiento',
        dueDate: yesterday,
        assignedToUserId: admin.id,
        done: false,
      });
    }
  };

  test('sin `limit`, pagina con el default (10) — 5 tareas caben todas en una página', async () => {
    await seedOverdueTasks(5);

    const res = await authed(request(app).get('/api/tasks?overdue=true'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.hasNext).toBe(false);
  });

  test('con `limit`, trunca la respuesta pero `pagination.total` refleja el conteo real', async () => {
    await seedOverdueTasks(8);

    const res = await authed(request(app).get('/api/tasks?overdue=true&limit=3'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.pagination.total).toBe(8);
    expect(res.body.pagination.hasNext).toBe(true);
  });

  test('con `leadIds`, sigue sin paginar — Kanban/detalle necesitan todas las tareas del lote', async () => {
    const lead = await createLead();
    await Task.create({
      leadId: lead.id,
      type: 'dar_seguimiento',
      dueDate: new Date(),
      assignedToUserId: admin.id,
      done: false,
    });

    const res = await authed(request(app).get(`/api/tasks?leadIds=${lead.id}`));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toBeUndefined();
  });
});
