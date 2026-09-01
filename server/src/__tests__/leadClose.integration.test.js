jest.mock('../services/emailService', () => ({
  sendNewLeadNotification: jest.fn().mockResolvedValue(),
  sendLeadConfirmation: jest.fn().mockResolvedValue(),
}));

const { Op } = require('sequelize');
const request = require('supertest');
const app = require('../../app');
const {
  sequelize,
  Lead,
  Deal,
  Task,
  Activity,
  AuditLog,
  User,
  Property,
} = require('../models/index');
const { createUser, authToken, createProperty, createLead } = require('./helpers/factories');

// AuditLog se escribe en logAudit() sin esperar la promesa (fire-and-forget) — se sondea
// brevemente en vez de asumir que ya está escrito justo después del response.
async function waitForAuditLog(where, { retries = 10, delayMs = 20 } = {}) {
  for (let i = 0; i < retries; i++) {
    const row = await AuditLog.findOne({ where, order: [['id', 'DESC']] });
    if (row) return row;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

describe('PUT /api/leads/:id/close-won, /close-lost y /reopen', () => {
  let admin, token;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    admin = await createUser({ role: 'admin' });
    token = authToken(admin);
  });

  afterEach(async () => {
    await Deal.destroy({ where: {}, force: true });
    await Task.destroy({ where: {}, force: true });
    await Activity.destroy({ where: {}, force: true });
    await AuditLog.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: admin.id }, force: true });
    await sequelize.close();
  });

  const authed = (req) => req.set('Authorization', `Bearer ${token}`);

  describe('close-won', () => {
    test('crea el Deal, mueve la etapa y cierra la task abierta', async () => {
      const property = await createProperty({ price: 850000 });
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}`)).send({ assignedToUserId: admin.id });
      const openTask = await Task.findOne({ where: { leadId: lead.id, done: false } });
      expect(openTask).not.toBeNull();

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 800000,
      });

      expect(res.status).toBe(200);
      expect(Number(res.body.data.deal.amount)).toBe(800000);

      await lead.reload();
      expect(lead.pipelineStage).toBe('venta_realizada');
      expect(lead.status).toBe('cerrado');

      const deals = await Deal.findAll({ where: { leadId: lead.id } });
      expect(deals).toHaveLength(1);
      expect(deals[0].propertyId).toBe(property.id);

      await openTask.reload();
      expect(openTask.done).toBe(true);
      expect(openTask.doneAt).not.toBeNull();
    });

    test('registra la auditoría con el dealId', async () => {
      const property = await createProperty();
      const lead = await createLead();

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });

      const auditRow = await waitForAuditLog({ resource: 'lead', resourceId: lead.id });
      expect(auditRow).not.toBeNull();
      const detail = JSON.parse(auditRow.detail);
      expect(detail.closedAs).toBe('won');
      expect(detail.dealId).toBe(res.body.data.deal.id);
    });

    test('rechaza cerrar dos veces la misma venta: no crea un segundo Deal', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });

      const second = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 999999,
      });

      expect(second.status).toBe(400);
      const deals = await Deal.findAll({ where: { leadId: lead.id } });
      expect(deals).toHaveLength(1);
      expect(Number(deals[0].amount)).toBe(500000);
    });

    test('corrige un cierre erróneo como perdido: limpia closeReason y lo marca como venta', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'sin_presupuesto',
      });

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });

      expect(res.status).toBe(200);
      await lead.reload();
      expect(lead.pipelineStage).toBe('venta_realizada');
      expect(lead.closeReason).toBeNull();
      expect(lead.closeReasonDetail).toBeNull();

      const activity = await Activity.findOne({
        where: { leadId: lead.id },
        order: [['id', 'DESC']],
      });
      expect(activity.content).toMatch(/corrección de cierre anterior/i);
    });

    test.each([
      ['sin propertyId', { amount: 500000 }],
      ['sin amount', { propertyId: 1 }],
    ])('valida datos requeridos: %s', async (_label, body) => {
      const lead = await createLead();
      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send(body);

      expect(res.status).toBe(400);
      const count = await Deal.count({ where: { leadId: lead.id } });
      expect(count).toBe(0);
    });

    test('propiedad inexistente devuelve 404 y no crea Deal', async () => {
      const lead = await createLead();
      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: 999999,
        amount: 500000,
      });

      expect(res.status).toBe(404);
      const count = await Deal.count({ where: { leadId: lead.id } });
      expect(count).toBe(0);
    });

    test('lead inexistente devuelve 404', async () => {
      const res = await authed(request(app).put('/api/leads/999999/close-won')).send({
        propertyId: 1,
        amount: 500000,
      });
      expect(res.status).toBe(404);
    });

    test('rollback de transacción: si falla un paso posterior a crear el Deal, no queda nada a medias', async () => {
      const property = await createProperty();
      const lead = await createLead();
      const originalStage = lead.pipelineStage;

      // closeOpenTask (Task.update) corre DESPUÉS de crear el Deal y actualizar el lead
      // dentro de la misma transacción — forzar su fallo prueba que lo anterior se revierte.
      const spy = jest.spyOn(Task, 'update').mockRejectedValueOnce(new Error('fallo simulado'));

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 700000,
      });

      spy.mockRestore();

      expect(res.status).toBe(500);
      const deals = await Deal.findAll({ where: { leadId: lead.id } });
      expect(deals).toHaveLength(0);

      await lead.reload();
      expect(lead.pipelineStage).toBe(originalStage);
    });
  });

  describe('close-lost', () => {
    test('marca el lead como no_interesado y cierra la task abierta', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}`)).send({ assignedToUserId: admin.id });
      const openTask = await Task.findOne({ where: { leadId: lead.id, done: false } });

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'no_respondio',
      });

      expect(res.status).toBe(200);
      await lead.reload();
      expect(lead.pipelineStage).toBe('no_interesado');
      expect(lead.status).toBe('descartado');
      expect(lead.closeReason).toBe('no_respondio');

      await openTask.reload();
      expect(openTask.done).toBe(true);
    });

    test('rechaza cerrar dos veces como perdido', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'otro',
        closeReasonDetail: 'x',
      });
      const second = await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'no_respondio',
      });

      expect(second.status).toBe(400);
      await lead.reload();
      expect(lead.closeReason).toBe('otro'); // no se sobrescribió con el segundo intento
    });

    test('corrige una venta registrada por error: destruye el Deal existente', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(1);

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'compro_competencia',
      });

      expect(res.status).toBe(200);
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(0);

      const activity = await Activity.findOne({
        where: { leadId: lead.id },
        order: [['id', 'DESC']],
      });
      expect(activity.content).toMatch(/corrección de venta registrada por error/i);
    });

    test('rechaza motivo inválido', async () => {
      const lead = await createLead();
      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'motivo-inventado',
      });
      expect(res.status).toBe(400);
    });

    test('motivo "otro" sin detalle es rechazado', async () => {
      const lead = await createLead();
      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'otro',
      });
      expect(res.status).toBe(400);
    });

    test('rollback de transacción: si falla un paso posterior, el Deal destruido se restaura', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });

      const spy = jest.spyOn(Task, 'update').mockRejectedValueOnce(new Error('fallo simulado'));

      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'no_respondio',
      });

      spy.mockRestore();

      expect(res.status).toBe(500);
      await lead.reload();
      expect(lead.pipelineStage).toBe('venta_realizada'); // no se revirtió a no_interesado
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(1); // el destroy se revirtió
    });
  });

  describe('reopen', () => {
    test('rechaza reabrir un prospecto que no está cerrado', async () => {
      const lead = await createLead(); // pipelineStage: 'nuevo' por defecto
      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});
      expect(res.status).toBe(400);
    });

    test('lead inexistente devuelve 404', async () => {
      const res = await authed(request(app).put('/api/leads/999999/reopen')).send({});
      expect(res.status).toBe(404);
    });

    test('reabre desde no_interesado: limpia closeReason y vuelve a contactado por defecto', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'sin_presupuesto',
      });

      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      expect(res.status).toBe(200);
      await lead.reload();
      expect(lead.pipelineStage).toBe('contactado');
      expect(lead.status).toBe('contactado');
      expect(lead.closeReason).toBeNull();
      expect(lead.closeReasonDetail).toBeNull();

      const activity = await Activity.findOne({
        where: { leadId: lead.id },
        order: [['id', 'DESC']],
      });
      expect(activity.content).toMatch(/reabierto/i);
    });

    test('reabre desde venta_realizada: destruye el Deal existente', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(1);

      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      expect(res.status).toBe(200);
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(0);

      const activity = await Activity.findOne({
        where: { leadId: lead.id },
        order: [['id', 'DESC']],
      });
      expect(activity.content).toMatch(/se eliminó la venta registrada/i);
    });

    test('acepta una etapa destino explícita no terminal', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'perdio_interes',
      });

      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({
        pipelineStage: 'negociacion',
      });

      expect(res.status).toBe(200);
      await lead.reload();
      expect(lead.pipelineStage).toBe('negociacion');
    });

    test('rechaza reabrir hacia otra etapa terminal', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'perdio_interes',
      });

      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({
        pipelineStage: 'venta_realizada',
      });

      expect(res.status).toBe(400);
      await lead.reload();
      expect(lead.pipelineStage).toBe('no_interesado'); // no se movió
    });

    test('restaura la invariante de la task: recrea una task abierta si el lead tiene responsable', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}`)).send({ assignedToUserId: admin.id });
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'no_respondio',
      });
      expect(await Task.count({ where: { leadId: lead.id, done: false } })).toBe(0);

      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      expect(res.status).toBe(200);
      const openTasks = await Task.findAll({ where: { leadId: lead.id, done: false } });
      expect(openTasks).toHaveLength(1);
      expect(openTasks[0].assignedToUserId).toBe(admin.id);
    });

    test('sin responsable asignado, reabrir no crea ninguna task (misma regla que al crear)', async () => {
      const lead = await createLead(); // sin assignedToUserId
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'no_respondio',
      });

      await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      const openTasks = await Task.count({ where: { leadId: lead.id, done: false } });
      expect(openTasks).toBe(0);
    });

    test('registra la auditoría de la reapertura', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });
      // El close-won ya generó una fila de auditoría — hay que esperar una MÁS reciente
      // que esa, o el poll podría devolver la del close-won por error.
      const closeWonAudit = await waitForAuditLog({ resource: 'lead', resourceId: lead.id });

      await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      const auditRow = await waitForAuditLog({
        resource: 'lead',
        resourceId: lead.id,
        id: { [Op.gt]: closeWonAudit.id },
      });
      const detail = JSON.parse(auditRow.detail);
      expect(detail.reopened).toBe(true);
      expect(detail.fromStage).toBe('venta_realizada');
      expect(detail.toStage).toBe('contactado');
      expect(detail.dealDeleted).toBe(true);
      // CRM-003: la auditoría debe conservar los datos financieros del Deal eliminado
      // (monto/propiedad/fecha de cierre), no solo el booleano de que "se borró algo".
      expect(detail.deletedDeal).toMatchObject({
        propertyId: property.id,
        propertyTitle: property.title,
      });
      expect(Number(detail.deletedDeal.amount)).toBe(500000);
    });

    test('la actividad de reapertura describe el monto y la propiedad de la venta eliminada', async () => {
      const property = await createProperty({ title: 'Casa de prueba CRM-003' });
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 750000,
      });

      await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      const activity = await Activity.findOne({
        where: { leadId: lead.id },
        order: [['id', 'DESC']],
      });
      expect(activity.content).toContain('Casa de prueba CRM-003');
      expect(activity.content).toMatch(/750,000|750000/);
    });

    test('reabrir una venta y volver a cerrarla no choca con el índice único de deals.leadId', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });
      await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(0);

      // CRM-003: el Deal original se borró (no es paranoid/soft-delete — ver comentario en
      // reopenLead sobre el índice único de leadId) — volver a cerrar como venta debe
      // poder crear un Deal nuevo sin violar esa restricción.
      const res = await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 600000,
      });

      expect(res.status).toBe(200);
      const deals = await Deal.findAll({ where: { leadId: lead.id } });
      expect(deals).toHaveLength(1);
      expect(Number(deals[0].amount)).toBe(600000);
    });

    test('rollback de transacción: si falla un paso posterior, el Deal destruido y la etapa se restauran', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}`)).send({ assignedToUserId: admin.id });
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });

      // ensureOpenTask (Task.create) corre al final, después de destruir el Deal y
      // actualizar el lead dentro de la misma transacción.
      const spy = jest.spyOn(Task, 'create').mockRejectedValueOnce(new Error('fallo simulado'));

      const res = await authed(request(app).put(`/api/leads/${lead.id}/reopen`)).send({});

      spy.mockRestore();

      expect(res.status).toBe(500);
      await lead.reload();
      expect(lead.pipelineStage).toBe('venta_realizada');
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(1);
    });
  });

  describe('PUT /api/leads/:id genérico sobre un lead ya cerrado (regresión del bug original)', () => {
    test('no permite cambiar pipelineStage de un lead cerrado — exige pasar por /reopen', async () => {
      const property = await createProperty();
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-won`)).send({
        propertyId: property.id,
        amount: 500000,
      });

      const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
        pipelineStage: 'contactado',
      });

      expect(res.status).toBe(400);
      await lead.reload();
      expect(lead.pipelineStage).toBe('venta_realizada'); // no se movió
      expect(await Deal.count({ where: { leadId: lead.id } })).toBe(1); // el Deal no quedó huérfano
    });

    test('sigue permitiendo actualizar otros campos (notas) en un lead cerrado', async () => {
      const lead = await createLead();
      await authed(request(app).put(`/api/leads/${lead.id}/close-lost`)).send({
        closeReason: 'no_respondio',
      });

      const res = await authed(request(app).put(`/api/leads/${lead.id}`)).send({
        notes: 'Llamó de nuevo, sigue sin interés',
      });

      expect(res.status).toBe(200);
      await lead.reload();
      expect(lead.notes).toBe('Llamó de nuevo, sigue sin interés');
      expect(lead.pipelineStage).toBe('no_interesado'); // sin cambios
    });
  });
});
