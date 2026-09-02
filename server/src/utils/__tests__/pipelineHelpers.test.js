const { sequelize, Lead, User } = require('../../models/index');
const { createUser, createLead } = require('../../__tests__/helpers/factories');
const { legacyStatusFor, logActivity } = require('../pipelineHelpers');

describe('pipelineHelpers', () => {
  let user;

  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    user = await createUser();
  });

  afterEach(async () => {
    await Lead.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await User.destroy({ where: { id: user.id }, force: true });
    await sequelize.close();
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
