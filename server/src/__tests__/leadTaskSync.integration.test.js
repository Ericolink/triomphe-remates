jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Task, Activity, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');
const { closeOpenTask } = require('../utils/pipelineHelpers');

// Cubre la sincronización Lead ⇄ Task abierta cuando cambia assignedToUserId (bug: la task
// se quedaba con el asesor anterior tras reasignar el lead). Ver PUT /api/leads/:id,
// syncOpenTaskAssignee en utils/pipelineHelpers.js.
describe('PUT /api/leads/:id — sincronización de la task abierta al reasignar', () => {
  let admin, token, userA, userB;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
    userA = await createUser({ role: 'admin' });
    userB = await createUser({ role: 'admin' });
  });

  afterEach(async () => {
    await Task.destroy({ where: {}, force: true });
    await Activity.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: [admin.id, userA.id, userB.id] }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('reasigna la task abierta cuando el lead cambia de asesor (userA → userB)', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    const openTask = await Task.findOne({ where: { leadId: lead.id, done: false } });
    expect(openTask.assignedToUserId).toBe(userA.id);

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userB.id,
    });

    expect(res.status).toBe(200);
    await openTask.reload();
    expect(openTask.assignedToUserId).toBe(userB.id);
    expect(openTask.done).toBe(false);

    // No se creó una segunda task.
    const openCount = await Task.count({ where: { leadId: lead.id, done: false } });
    expect(openCount).toBe(1);
    const totalCount = await Task.count({ where: { leadId: lead.id } });
    expect(totalCount).toBe(1);
  });

  test('desasignar el lead (assignedToUserId → null) cierra la task abierta', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    const openTask = await Task.findOne({ where: { leadId: lead.id, done: false } });
    expect(openTask).not.toBeNull();

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: null,
    });

    expect(res.status).toBe(200);
    await openTask.reload();
    expect(openTask.done).toBe(true);
    expect(openTask.doneAt).not.toBeNull();
  });

  test('lead sin task abierta: reasignarlo crea la task para el nuevo asesor (self-heal de la invariante)', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    // Simula drift: la task abierta se cierra por fuera del flujo normal.
    await closeOpenTask({ leadId: lead.id });
    expect(await Task.count({ where: { leadId: lead.id, done: false } })).toBe(0);

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userB.id,
    });

    expect(res.status).toBe(200);
    const openTasks = await Task.findAll({ where: { leadId: lead.id, done: false } });
    expect(openTasks).toHaveLength(1);
    expect(openTasks[0].assignedToUserId).toBe(userB.id);
  });

  test('lead con task cerrada: la task cerrada no se toca al reasignar', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    const firstTask = await Task.findOne({ where: { leadId: lead.id } });
    await closeOpenTask({ leadId: lead.id });
    await firstTask.reload();
    expect(firstTask.done).toBe(true);
    const originalAssignee = firstTask.assignedToUserId;

    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userB.id,
    });

    await firstTask.reload();
    expect(firstTask.assignedToUserId).toBe(originalAssignee); // sin cambios
    expect(firstTask.done).toBe(true);
  });

  test('asesor sin cambios (mismo assignedToUserId) no toca la task', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    const openTask = await Task.findOne({ where: { leadId: lead.id, done: false } });
    const updatedAtBefore = openTask.updatedAt.getTime();

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
      notes: 'sin cambio de responsable',
    });

    expect(res.status).toBe(200);
    await openTask.reload();
    expect(openTask.assignedToUserId).toBe(userA.id);
    expect(openTask.updatedAt.getTime()).toBe(updatedAtBefore);
  });

  test('múltiples tasks históricas: solo la abierta se modifica al reasignar', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    const task1 = await Task.findOne({ where: { leadId: lead.id, done: false } });
    await closeOpenTask({ leadId: lead.id }); // cierra task1

    // Segunda task histórica, también cerrada, con otro asesor — nunca debe tocarse.
    const task2 = await Task.create({
      leadId: lead.id,
      type: 'dar_seguimiento',
      dueDate: new Date(),
      assignedToUserId: admin.id,
      done: true,
      doneAt: new Date(),
    });

    // Task abierta actual (la que sí debe sincronizarse).
    const task3 = await Task.create({
      leadId: lead.id,
      type: 'llamar',
      dueDate: new Date(),
      assignedToUserId: userA.id,
      done: false,
    });

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userB.id,
    });
    expect(res.status).toBe(200);

    await task1.reload();
    await task2.reload();
    await task3.reload();

    expect(task1.assignedToUserId).toBe(userA.id); // histórica, sin tocar
    expect(task2.assignedToUserId).toBe(admin.id); // histórica, sin tocar
    expect(task3.assignedToUserId).toBe(userB.id); // la única abierta, sincronizada
    expect(task3.done).toBe(false);
  });

  test('reasignar un lead cerrado (etapa terminal) no crea una task nueva', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
      closeReason: 'no_respondio',
    });
    expect(await Task.count({ where: { leadId: lead.id, done: false } })).toBe(0);

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userB.id,
    });

    expect(res.status).toBe(200);
    expect(await Task.count({ where: { leadId: lead.id, done: false } })).toBe(0);
  });

  test('rollback de transacción: si falla un paso posterior, ni el lead ni la task quedan reasignados', async () => {
    const lead = await createLead();
    await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userA.id,
    });
    const openTask = await Task.findOne({ where: { leadId: lead.id, done: false } });

    // syncOpenTaskAssignee (Task.update) corre después de lead.update() y del logActivity de
    // reasignación, dentro de la misma transacción — forzar su fallo prueba que todo eso
    // también se revierte.
    const spy = jest.spyOn(Task, 'update').mockRejectedValueOnce(new Error('fallo simulado'));

    const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
      assignedToUserId: userB.id,
    });

    spy.mockRestore();

    expect(res.status).toBe(500);

    await lead.reload();
    expect(lead.assignedToUserId).toBe(userA.id); // no se reasignó

    await openTask.reload();
    expect(openTask.assignedToUserId).toBe(userA.id); // la task tampoco cambió

    // La primera asignación (null → userA) sí se registró antes; el intento fallido
    // (userA → userB) debe haberse revertido junto con el resto de la transacción, así que
    // solo debe existir esa primera actividad.
    const reassignActivities = await Activity.findAll({
      where: { leadId: lead.id, type: 'reasignacion' },
    });
    expect(reassignActivities).toHaveLength(1);
    expect(reassignActivities[0].newAssignedToUserId).toBe(userA.id);
  });
});
