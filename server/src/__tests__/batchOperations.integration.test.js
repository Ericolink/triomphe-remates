jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Feedback, AuditLog, User } = require('../models/index');
const { MAX_BATCH_IDS } = require('../utils/batchValidation');
const { createUser, authToken, createLead } = require('./helpers/factories');

async function createFeedback(overrides = {}) {
  return Feedback.create({
    category: 'comentario',
    name: overrides.name || 'Cliente de prueba',
    email: overrides.email || 'cliente-batch@test.com',
    subject: overrides.subject || 'Asunto de prueba',
    message: overrides.message || 'Mensaje de prueba',
  });
}

describe('Guardarraíl de operaciones batch (ids)', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await AuditLog.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
    await Feedback.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  describe('PATCH /api/leads/batch', () => {
    test('operación válida actualiza los leads indicados', async () => {
      const l1 = await createLead();
      const l2 = await createLead();

      const res = await authed(request(app).patch('/api/leads/batch')).send({
        ids: [l1.id, l2.id],
        pipelineStage: 'contactado',
      });

      expect(res.status).toBe(200);
      const updated = await Lead.findByPk(l1.id);
      expect(updated.pipelineStage).toBe('contactado');
    });

    test('rechaza arreglo vacío', async () => {
      const res = await authed(request(app).patch('/api/leads/batch')).send({
        ids: [],
        pipelineStage: 'contactado',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/requeridos/i);
    });

    test('rechaza ids que no es un arreglo', async () => {
      const res = await authed(request(app).patch('/api/leads/batch')).send({
        ids: 'no-es-un-arreglo',
        pipelineStage: 'contactado',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/arreglo/i);
    });

    test('rechaza un arreglo que excede el límite permitido', async () => {
      const tooMany = Array.from({ length: MAX_BATCH_IDS + 1 }, (_, i) => i + 1);
      const res = await authed(request(app).patch('/api/leads/batch')).send({
        ids: tooMany,
        pipelineStage: 'contactado',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain(String(MAX_BATCH_IDS));
    });

    test('rechaza ids con formato inválido', async () => {
      const res = await authed(request(app).patch('/api/leads/batch')).send({
        ids: [1, 'DROP TABLE leads'],
        pipelineStage: 'contactado',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/inválido/i);
    });
  });

  describe('DELETE /api/leads/batch', () => {
    test('operación válida elimina los leads indicados', async () => {
      const l1 = await createLead();
      const res = await authed(request(app).delete('/api/leads/batch')).send({ ids: [l1.id] });
      expect(res.status).toBe(200);
      expect(await Lead.findByPk(l1.id)).toBeNull();
    });

    test('rechaza un arreglo que excede el límite permitido', async () => {
      const tooMany = Array.from({ length: MAX_BATCH_IDS + 1 }, (_, i) => i + 1);
      const res = await authed(request(app).delete('/api/leads/batch')).send({ ids: tooMany });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/feedback/batch', () => {
    test('operación válida actualiza el status', async () => {
      const f1 = await createFeedback();
      const res = await authed(request(app).patch('/api/feedback/batch')).send({
        ids: [f1.id],
        status: 'leido',
      });
      expect(res.status).toBe(200);
      const updated = await Feedback.findByPk(f1.id);
      expect(updated.status).toBe('leido');
    });

    test('rechaza tipos incorrectos de elementos dentro del arreglo', async () => {
      const res = await authed(request(app).patch('/api/feedback/batch')).send({
        ids: [{ id: 1 }],
        status: 'leido',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/feedback/batch', () => {
    test('operación válida elimina los mensajes indicados', async () => {
      const f1 = await createFeedback();
      const res = await authed(request(app).delete('/api/feedback/batch')).send({ ids: [f1.id] });
      expect(res.status).toBe(200);
      expect(await Feedback.findByPk(f1.id)).toBeNull();
    });

    test('rechaza arreglo vacío', async () => {
      const res = await authed(request(app).delete('/api/feedback/batch')).send({ ids: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/tasks?leadIds=... (mismo guardarraíl en lectura)', () => {
    test('rechaza más de MAX_BATCH_IDS leadIds en el query param', async () => {
      const tooMany = Array.from({ length: MAX_BATCH_IDS + 1 }, (_, i) => i + 1).join(',');
      const res = await authed(request(app).get('/api/tasks')).query({ leadIds: tooMany });
      expect(res.status).toBe(400);
    });

    test('acepta una lista normal de leadIds', async () => {
      const res = await authed(request(app).get('/api/tasks')).query({ leadIds: '1,2,3' });
      expect(res.status).toBe(200);
    });
  });
});
