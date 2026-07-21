const { sequelize, Task, Activity, Lead, User } = require('../../models/index');
const { createUser, createLead } = require('../../__tests__/helpers/factories');
const {
  ensureOpenTask,
  closeOpenTask,
  legacyStatusFor,
  logActivity,
} = require('../pipelineHelpers');

describe('pipelineHelpers', () => {
  let user;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    user = await createUser();
  });

  afterEach(async () => {
    await Task.destroy({ where: {}, force: true });
    await Activity.destroy({ where: {}, force: true });
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: user.id }, force: true });
    await sequelize.close();
  });

  describe('ensureOpenTask — invariante "una sola task abierta por prospecto"', () => {
    test('crea una task cuando el lead no tiene ninguna abierta', async () => {
      const lead = await createLead();
      const task = await ensureOpenTask({ leadId: lead.id, assignedToUserId: user.id });

      expect(task).not.toBeNull();
      expect(task.done).toBe(false);
      const count = await Task.count({ where: { leadId: lead.id } });
      expect(count).toBe(1);
    });

    test('NUNCA crea una segunda task abierta: devuelve la existente', async () => {
      const lead = await createLead();
      const first = await ensureOpenTask({
        leadId: lead.id,
        assignedToUserId: user.id,
        type: 'llamar',
      });
      const second = await ensureOpenTask({
        leadId: lead.id,
        assignedToUserId: user.id,
        type: 'dar_seguimiento',
      });

      expect(second.id).toBe(first.id);
      expect(second.type).toBe('llamar'); // no se sobrescribió con la segunda llamada
      const count = await Task.count({ where: { leadId: lead.id, done: false } });
      expect(count).toBe(1);
    });

    test('sin assignedToUserId no crea ninguna task (prospecto sin responsable)', async () => {
      const lead = await createLead();
      const task = await ensureOpenTask({ leadId: lead.id, assignedToUserId: null });

      expect(task).toBeNull();
      const count = await Task.count({ where: { leadId: lead.id } });
      expect(count).toBe(0);
    });

    test('después de cerrar la task abierta, sí se puede abrir una nueva', async () => {
      const lead = await createLead();
      const first = await ensureOpenTask({ leadId: lead.id, assignedToUserId: user.id });
      await closeOpenTask({ leadId: lead.id });

      const second = await ensureOpenTask({
        leadId: lead.id,
        assignedToUserId: user.id,
        type: 'visita',
      });

      expect(second.id).not.toBe(first.id);
      const openCount = await Task.count({ where: { leadId: lead.id, done: false } });
      expect(openCount).toBe(1);
    });

    test('usa mañana como dueDate por defecto', async () => {
      const lead = await createLead();
      const before = Date.now();
      const task = await ensureOpenTask({ leadId: lead.id, assignedToUserId: user.id });
      const diffMs = new Date(task.dueDate).getTime() - before;

      // Tolerancia amplia (23-25h) para no ser frágil ante el tiempo de ejecución del test.
      expect(diffMs).toBeGreaterThan(23 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(25 * 60 * 60 * 1000);
    });
  });

  describe('closeOpenTask', () => {
    test('marca done=true y setea doneAt en la task abierta', async () => {
      const lead = await createLead();
      const task = await ensureOpenTask({ leadId: lead.id, assignedToUserId: user.id });

      const count = await closeOpenTask({ leadId: lead.id });

      expect(count).toBe(1);
      await task.reload();
      expect(task.done).toBe(true);
      expect(task.doneAt).not.toBeNull();
    });

    test('no falla y devuelve 0 si el lead no tiene ninguna task abierta', async () => {
      const lead = await createLead();
      const count = await closeOpenTask({ leadId: lead.id });
      expect(count).toBe(0);
    });

    test('no toca tasks abiertas de otros leads', async () => {
      const leadA = await createLead();
      const leadB = await createLead();
      await ensureOpenTask({ leadId: leadA.id, assignedToUserId: user.id });
      const taskB = await ensureOpenTask({ leadId: leadB.id, assignedToUserId: user.id });

      await closeOpenTask({ leadId: leadA.id });

      await taskB.reload();
      expect(taskB.done).toBe(false);
    });

    test('cerrar dos veces seguidas es seguro (idempotente)', async () => {
      const lead = await createLead();
      await ensureOpenTask({ leadId: lead.id, assignedToUserId: user.id });

      const first = await closeOpenTask({ leadId: lead.id });
      const second = await closeOpenTask({ leadId: lead.id });

      expect(first).toBe(1);
      expect(second).toBe(0);
    });
  });

  describe('legacyStatusFor', () => {
    test.each([
      ['nuevo', 'nuevo'],
      ['contactado', 'contactado'],
      ['interesado', 'contactado'],
      ['cita_agendada', 'contactado'],
      ['cita_realizada', 'contactado'],
      ['negociacion', 'contactado'],
      ['venta_realizada', 'cerrado'],
      ['no_interesado', 'descartado'],
    ])('%s → %s', (stage, expected) => {
      expect(legacyStatusFor(stage)).toBe(expected);
    });

    test('etapa desconocida cae a "nuevo" en vez de lanzar', () => {
      expect(legacyStatusFor('etapa-inexistente')).toBe('nuevo');
      expect(legacyStatusFor(undefined)).toBe('nuevo');
    });
  });

  describe('logActivity', () => {
    test('crea la actividad con occurredAt y sin userId por defecto', async () => {
      const lead = await createLead();
      const activity = await logActivity({ leadId: lead.id, type: 'sistema', content: 'Prueba' });

      expect(activity.leadId).toBe(lead.id);
      expect(activity.userId).toBeNull();
      expect(activity.occurredAt).not.toBeNull();
    });

    test('acepta userId cuando se provee', async () => {
      const lead = await createLead();
      const activity = await logActivity({
        leadId: lead.id,
        type: 'sistema',
        content: 'Prueba',
        userId: user.id,
      });
      expect(activity.userId).toBe(user.id);
    });
  });
});
