const request = require('supertest');
const app = require('../../app');
const { sequelize, Task, Lead, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('GET /api/tasks — limit opcional (AUDIT: sin leadIds, findAll no tenía tope)', () => {
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

  test('sin `limit`, devuelve todas las tareas — comportamiento sin cambios para Kanban/detalle', async () => {
    await seedOverdueTasks(5);

    const res = await authed(request(app).get('/api/tasks?overdue=true'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.total).toBe(5);
  });

  test('con `limit`, trunca la respuesta pero `total` refleja el conteo real', async () => {
    await seedOverdueTasks(8);

    const res = await authed(request(app).get('/api/tasks?overdue=true&limit=3'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.total).toBe(8);
  });
});
