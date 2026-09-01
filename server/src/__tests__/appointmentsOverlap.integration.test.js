// CAL-002 — no existía ninguna verificación de traslape de horario: dos citas del mismo
// asesor en horarios encimados (ej. 10:00–11:00 y 10:30–11:30) podían crearse sin ningún
// aviso, tanto por backend como por frontend. Estos tests verifican la validación de
// traslape (createAppointment/rescheduleAppointment en appointmentController.js) y, con un
// caso de concurrencia real (dos requests simultáneos), que la transacción SERIALIZABLE
// realmente evita que ambos pasen la verificación antes de que cualquiera inserte nada.
jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Appointment, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('Citas — prevención de doble reserva para el mismo asesor (CAL-002)', () => {
  let admin, token, asesorA, asesorB;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    asesorA = await createUser({ role: 'asesor_ventas' });
    asesorB = await createUser({ role: 'asesor_ventas' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Appointment.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: [admin.id, asesorA.id, asesorB.id] }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('rechaza una segunda cita del mismo asesor que se traslapa con la primera (10:00–11:00 vs 10:30–11:30)', async () => {
    const leadA = await createLead({ assignedToUserId: asesorA.id });
    const leadB = await createLead({ assignedToUserId: asesorA.id });

    const first = await authed(request(app).post('/api/appointments')).send({
      leadId: leadA.id,
      scheduledAt: '2026-06-15T16:00:00.000Z', // 10:00
    });
    expect(first.status).toBe(201);

    const second = await authed(request(app).post('/api/appointments')).send({
      leadId: leadB.id,
      scheduledAt: '2026-06-15T16:30:00.000Z', // 10:30 — se traslapa con la de arriba
    });

    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/ya tiene otra cita/i);
    expect(await Appointment.count()).toBe(1);
  });

  test('permite dos citas del mismo asesor si no se traslapan (más de 1 hora de diferencia)', async () => {
    const leadA = await createLead({ assignedToUserId: asesorA.id });
    const leadB = await createLead({ assignedToUserId: asesorA.id });

    const first = await authed(request(app).post('/api/appointments')).send({
      leadId: leadA.id,
      scheduledAt: '2026-06-15T16:00:00.000Z', // 10:00
    });
    expect(first.status).toBe(201);

    const second = await authed(request(app).post('/api/appointments')).send({
      leadId: leadB.id,
      scheduledAt: '2026-06-15T18:00:00.000Z', // 12:00 — 2 horas después, sin traslape
    });

    expect(second.status).toBe(201);
    expect(await Appointment.count()).toBe(2);
  });

  test('permite citas al mismo horario para DOS asesores distintos (el traslape es por asesor, no global)', async () => {
    const leadA = await createLead({ assignedToUserId: asesorA.id });
    const leadB = await createLead({ assignedToUserId: asesorB.id });

    const first = await authed(request(app).post('/api/appointments')).send({
      leadId: leadA.id,
      scheduledAt: '2026-06-15T16:00:00.000Z',
    });
    const second = await authed(request(app).post('/api/appointments')).send({
      leadId: leadB.id,
      scheduledAt: '2026-06-15T16:00:00.000Z',
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  test('una cita cancelada no bloquea agendar una nueva en su mismo horario', async () => {
    const leadA = await createLead({ assignedToUserId: asesorA.id });
    const leadB = await createLead({ assignedToUserId: asesorA.id });

    const first = await authed(request(app).post('/api/appointments')).send({
      leadId: leadA.id,
      scheduledAt: '2026-06-15T16:00:00.000Z',
    });
    await authed(request(app).patch(`/api/appointments/${first.body.data.id}`)).send({
      status: 'cancelada',
    });

    const second = await authed(request(app).post('/api/appointments')).send({
      leadId: leadB.id,
      scheduledAt: '2026-06-15T16:00:00.000Z',
    });

    expect(second.status).toBe(201);
  });

  test('reagendar hacia un horario que choca con otra cita del mismo asesor se rechaza', async () => {
    const leadA = await createLead({ assignedToUserId: asesorA.id });
    const leadB = await createLead({ assignedToUserId: asesorA.id });

    await authed(request(app).post('/api/appointments')).send({
      leadId: leadA.id,
      scheduledAt: '2026-06-15T16:00:00.000Z', // 10:00
    });
    const toReschedule = await authed(request(app).post('/api/appointments')).send({
      leadId: leadB.id,
      scheduledAt: '2026-06-16T16:00:00.000Z', // otro día, sin conflicto todavía
    });
    expect(toReschedule.status).toBe(201);

    const rescheduleRes = await authed(
      request(app).post(`/api/appointments/${toReschedule.body.data.id}/reschedule`)
    ).send({ scheduledAt: '2026-06-15T16:15:00.000Z' }); // ahora sí choca con la primera

    expect(rescheduleRes.status).toBe(409);
    // La cita que se intentaba reagendar sigue viva (no se marcó cancelada si el nuevo
    // horario no era válido) — la transacción completa se revierte.
    const original = await Appointment.findByPk(toReschedule.body.data.id);
    expect(original.status).not.toBe('cancelada');
  });

  test('concurrencia: dos requests simultáneos por el mismo horario del mismo asesor — solo uno debe tener éxito', async () => {
    const leadA = await createLead({ assignedToUserId: asesorA.id });
    const leadB = await createLead({ assignedToUserId: asesorA.id });

    const [resA, resB] = await Promise.all([
      authed(request(app).post('/api/appointments')).send({
        leadId: leadA.id,
        scheduledAt: '2026-06-15T16:00:00.000Z',
      }),
      authed(request(app).post('/api/appointments')).send({
        leadId: leadB.id,
        scheduledAt: '2026-06-15T16:15:00.000Z', // se traslapa con la de arriba
      }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    // Uno de los dos debe haber ganado (201) y el otro perdido (409) — nunca ambos 201.
    expect(statuses).toEqual([201, 409]);
    expect(await Appointment.count()).toBe(1);
  });
});
