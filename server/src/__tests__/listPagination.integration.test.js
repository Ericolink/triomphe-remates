const request = require('supertest');
const app = require('../../app');
const { sequelize, User, JobPosition, JobApplication, Feedback } = require('../models/index');
const { createUser, authToken } = require('./helpers/factories');

// AUDIT: usersController.getUsers, jobController.getAllPositions/getApplications y
// feedbackController.getFeedbacks no tenían límite (o, en feedback, no tenían `search`).
// Cubre que el fix no rompa a los callers que dependen de la lista completa (selectores
// de "responsable") y que la paginación con includes hasMany (JobPosition->applications)
// cuente bien con `distinct: true`.
describe('Paginación opcional en listados admin', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  describe('GET /api/users', () => {
    let extraUsers;

    beforeAll(async () => {
      extraUsers = await Promise.all([
        createUser({ role: 'editor' }),
        createUser({ role: 'editor' }),
        createUser({ role: 'editor' }),
      ]);
    });

    afterAll(async () => {
      await User.destroy({ where: { id: extraUsers.map((u) => u.id) }, force: true });
    });

    test('sin page/limit devuelve la lista completa sin metadata de paginación (usado por selectores de responsable)', async () => {
      const res = await authed(request(app).get('/api/users'));
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeUndefined();
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    });

    test('con page/limit, pagina y expone el total real', async () => {
      const res = await authed(request(app).get('/api/users?page=1&limit=2'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
    });
  });

  describe('GET /api/jobs/admin/all', () => {
    let positions;

    beforeAll(async () => {
      positions = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          JobPosition.create({
            title: `Vacante paginación ${i}`,
            description: 'desc',
            requirements: 'req',
          })
        )
      );
      // Dos postulaciones sobre la misma vacante — sin `distinct: true` esto duplicaba
      // el conteo de findAndCountAll (join hasMany).
      await JobApplication.bulkCreate([
        {
          jobPositionId: positions[0].id,
          name: 'A',
          email: 'a@test.com',
          phone: '111',
          city: 'juarez',
          experience: 'sin_experiencia',
        },
        {
          jobPositionId: positions[0].id,
          name: 'B',
          email: 'b@test.com',
          phone: '222',
          city: 'juarez',
          experience: 'sin_experiencia',
        },
      ]);
    });

    afterAll(async () => {
      await JobApplication.destroy({ where: { jobPositionId: positions.map((p) => p.id) }, force: true });
      await JobPosition.destroy({ where: { id: positions.map((p) => p.id) }, force: true });
    });

    test('con page/limit, el total no se infla por la vacante con 2 postulaciones', async () => {
      const res = await authed(request(app).get('/api/jobs/admin/all?page=1&limit=2'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBe(3);
    });

    test('sin page/limit, comportamiento sin cambios (lista completa, sin metadata)', async () => {
      const res = await authed(request(app).get('/api/jobs/admin/all'));
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeUndefined();
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/jobs/applications', () => {
    let applications;

    beforeAll(async () => {
      applications = await JobApplication.bulkCreate([
        { name: 'Postulante 1', email: 'p1@test.com', phone: '111', city: 'juarez', experience: 'sin_experiencia' },
        { name: 'Postulante 2', email: 'p2@test.com', phone: '222', city: 'juarez', experience: 'sin_experiencia' },
        { name: 'Postulante 3', email: 'p3@test.com', phone: '333', city: 'juarez', experience: 'sin_experiencia' },
      ]);
    });

    afterAll(async () => {
      await JobApplication.destroy({ where: { id: applications.map((a) => a.id) }, force: true });
    });

    test('con page/limit, pagina y expone el total real', async () => {
      const res = await authed(request(app).get('/api/jobs/applications?page=1&limit=2'));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/feedback — search', () => {
    let feedbacks;

    beforeAll(async () => {
      feedbacks = await Feedback.bulkCreate([
        { name: 'Cliente Uno', email: 'c1@test.com', subject: 'Pregunta sobre remate', message: 'msg' },
        { name: 'Cliente Dos', email: 'c2@test.com', subject: 'Queja de servicio', message: 'msg' },
      ]);
    });

    afterAll(async () => {
      await Feedback.destroy({ where: { id: feedbacks.map((f) => f.id) }, force: true });
    });

    test('search filtra por subject en el backend', async () => {
      const res = await authed(request(app).get('/api/feedback?search=remate&page=1&limit=20'));
      expect(res.status).toBe(200);
      expect(res.body.data.some((f) => f.subject === 'Pregunta sobre remate')).toBe(true);
      expect(res.body.data.some((f) => f.subject === 'Queja de servicio')).toBe(false);
    });
  });
});
