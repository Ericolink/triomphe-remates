// CAL-001 — el frontend ahora envía `scheduledAt` como un ISO string con sufijo Z
// (UTC explícito, ver ContactForm.jsx / LeadDetailPanel.jsx / AppointmentDetailModal.jsx)
// en vez de un string "naive" sin zona horaria. Estos tests verifican el otro extremo del
// pipeline: que crear/leer/reagendar una cita a través de la API conserva exactamente el
// mismo instante, sin desplazamientos — el requisito explícito de "no queremos cambiar la
// interpretación de citas antiguas accidentalmente" se traduce en que el round-trip
// Sequelize↔MySQL de un valor ya-correcto (UTC explícito) debe ser una identidad, sea cual
// sea la config regional del proceso.
jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const app = require('../../app');
const { sequelize, Lead, Appointment, User } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('Citas — el instante programado no se desplaza al guardarse/leerse (CAL-001)', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Appointment.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  test('crear una cita y recuperarla devuelve exactamente el mismo instante UTC enviado', async () => {
    const lead = await createLead();
    const scheduledAt = '2026-06-15T21:00:00.000Z'; // 15:00 hora de Chihuahua

    const createRes = await authed(request(app).post('/api/appointments')).send({
      leadId: lead.id,
      scheduledAt,
    });
    expect(createRes.status).toBe(201);

    const stored = await Appointment.findByPk(createRes.body.data.id);
    expect(stored.scheduledAt.toISOString()).toBe(scheduledAt);

    const listRes = await authed(request(app).get(`/api/leads/${lead.id}/appointments`));
    expect(new Date(listRes.body.data[0].scheduledAt).toISOString()).toBe(scheduledAt);
  });

  test('reagendar conserva el nuevo instante exacto y no toca la hora de la cita original', async () => {
    const lead = await createLead();
    const original = '2026-06-15T21:00:00.000Z';
    const rescheduled = '2026-06-17T15:00:00.000Z'; // otro día, otra hora

    const createRes = await authed(request(app).post('/api/appointments')).send({
      leadId: lead.id,
      scheduledAt: original,
    });

    const rescheduleRes = await authed(
      request(app).post(`/api/appointments/${createRes.body.data.id}/reschedule`)
    ).send({ scheduledAt: rescheduled });
    expect(rescheduleRes.status).toBe(200);

    const oldAppointment = await Appointment.findByPk(createRes.body.data.id);
    expect(oldAppointment.status).toBe('cancelada');
    expect(oldAppointment.scheduledAt.toISOString()).toBe(original); // no se movió

    const newAppointment = await Appointment.findByPk(rescheduleRes.body.data.id);
    expect(newAppointment.scheduledAt.toISOString()).toBe(rescheduled);
    expect(newAppointment.rescheduledFromId).toBe(oldAppointment.id);
  });

  test('una cita justo en el filo de medianoche (UTC) tampoco se desplaza de día', async () => {
    // 2026-06-16T05:59:00.000Z es todavía 2026-06-15 23:59 en Chihuahua (UTC-6) — un caso
    // límite útil para detectar si algo en el pipeline reconstruyera la fecha a partir de
    // solo year/month/day en vez de conservar el instante completo.
    const lead = await createLead();
    const scheduledAt = '2026-06-16T05:59:00.000Z';

    const createRes = await authed(request(app).post('/api/appointments')).send({
      leadId: lead.id,
      scheduledAt,
    });
    expect(createRes.status).toBe(201);

    const stored = await Appointment.findByPk(createRes.body.data.id);
    expect(stored.scheduledAt.toISOString()).toBe(scheduledAt);
  });
});
