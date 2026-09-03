// Jerarquía coordinador_ventas -> asesor_ventas (ver server/src/utils/leadAccess.js): un
// coordinador ve/reasigna los leads de su equipo (él mismo + sus asesores supervisados,
// User.supervisorId), pero solo EDITA (cambia pipeline/otros campos) los que tiene
// asignados a sí mismo — reasignar es la única acción que puede hacer sobre un lead de un
// asesor de su equipo que no es él mismo.
const request = require('supertest');
const app = require('../../app');
const { sequelize, User, Lead } = require('../models/index');
const { createUser, authToken, createLead } = require('./helpers/factories');

describe('CRM de leads — acceso de coordinador_ventas a los leads de su equipo', () => {
  let coordinador, asesorEquipo, asesorFuera, admin;
  let coordinadorToken, adminToken;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    coordinador = await createUser({ role: 'coordinador_ventas' });
    asesorEquipo = await createUser({ role: 'asesor_ventas', supervisorId: coordinador.id });
    asesorFuera = await createUser({ role: 'asesor_ventas' });
    admin = await createUser({ role: 'admin' });
    coordinadorToken = authToken(coordinador);
    adminToken = authToken(admin);
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({
      where: { id: [coordinador.id, asesorEquipo.id, asesorFuera.id, admin.id] },
      force: true,
    });
    await sequelize.close();
  });

  const authed = (token) => (req) => req.set('Authorization', `Bearer ${token}`);

  describe('ver', () => {
    test('el coordinador ve en el listado un lead asignado a un asesor de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: asesorEquipo.id });
      const res = await authed(coordinadorToken)(request(app).get('/api/leads'));
      expect(res.status).toBe(200);
      expect(res.body.data.some((l) => l.id === lead.id)).toBe(true);
    });

    test('el coordinador puede abrir el detalle completo de un lead de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: asesorEquipo.id });
      const res = await authed(coordinadorToken)(request(app).get(`/api/leads/${lead.id}`));
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(lead.id);
    });

    test('el coordinador NO ve en el listado un lead fuera de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: asesorFuera.id });
      const res = await authed(coordinadorToken)(request(app).get('/api/leads'));
      expect(res.status).toBe(200);
      expect(res.body.data.some((l) => l.id === lead.id)).toBe(false);
    });

    test('el coordinador recibe 403 al intentar abrir el detalle de un lead fuera de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: asesorFuera.id });
      const res = await authed(coordinadorToken)(request(app).get(`/api/leads/${lead.id}`));
      expect(res.status).toBe(403);
    });
  });

  describe('editar', () => {
    test('el coordinador SÍ puede editar/mover de etapa un lead asignado a sí mismo', async () => {
      const lead = await createLead({ assignedToUserId: coordinador.id, pipelineStage: 'nuevo' });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        pipelineStage: 'contactado',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.pipelineStage).toBe('contactado');
    });

    test('el coordinador NO puede cambiar la etapa de un lead de su equipo que no tiene asignado a sí mismo', async () => {
      const lead = await createLead({ assignedToUserId: asesorEquipo.id, pipelineStage: 'nuevo' });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        pipelineStage: 'contactado',
      });
      expect(res.status).toBe(403);

      const stored = await Lead.findByPk(lead.id);
      expect(stored.pipelineStage).toBe('nuevo');
    });

    test('el coordinador NO puede editar ningún campo de un lead fuera de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: asesorFuera.id, name: 'Original' });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        name: 'Modificado',
      });
      expect(res.status).toBe(403);

      const stored = await Lead.findByPk(lead.id);
      expect(stored.name).toBe('Original');
    });
  });

  describe('reasignar', () => {
    test('el coordinador reasigna un lead de su equipo (de un asesor a sí mismo)', async () => {
      const lead = await createLead({ assignedToUserId: asesorEquipo.id });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        assignedToUserId: coordinador.id,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.assignedToUserId).toBe(coordinador.id);
    });

    test('el coordinador reasigna un lead que tiene asignado a sí mismo, a un asesor de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: coordinador.id });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        assignedToUserId: asesorEquipo.id,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.assignedToUserId).toBe(asesorEquipo.id);
    });

    test('el coordinador NO puede reasignar un lead de su equipo a alguien fuera de su equipo', async () => {
      const lead = await createLead({ assignedToUserId: asesorEquipo.id });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        assignedToUserId: asesorFuera.id,
      });
      expect(res.status).toBe(403);

      const stored = await Lead.findByPk(lead.id);
      expect(stored.assignedToUserId).toBe(asesorEquipo.id);
    });

    test('el coordinador NO puede reasignar un lead que está fuera de su equipo (aunque el destino sí sea válido)', async () => {
      const lead = await createLead({ assignedToUserId: asesorFuera.id });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        assignedToUserId: asesorEquipo.id,
      });
      expect(res.status).toBe(403);

      const stored = await Lead.findByPk(lead.id);
      expect(stored.assignedToUserId).toBe(asesorFuera.id);
    });

    test('reasignar además de otro campo en la misma request no cuenta como "solo reasignar" — se rechaza', async () => {
      const lead = await createLead({ assignedToUserId: asesorEquipo.id, name: 'Original' });
      const res = await authed(coordinadorToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        assignedToUserId: coordinador.id,
        name: 'Intento de colarse',
      });
      expect(res.status).toBe(403);

      const stored = await Lead.findByPk(lead.id);
      expect(stored.assignedToUserId).toBe(asesorEquipo.id);
      expect(stored.name).toBe('Original');
    });

    test('admin sigue pudiendo asignar un lead directo al coordinador (para que él lo reparta)', async () => {
      const lead = await createLead({});
      const res = await authed(adminToken)(request(app).put(`/api/leads/${lead.id}`)).send({
        assignedToUserId: coordinador.id,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.assignedToUserId).toBe(coordinador.id);
    });
  });
});
