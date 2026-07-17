jest.mock('../emailService', () => ({ sendPropertyAlertNotification: jest.fn().mockResolvedValue() }));
jest.mock('../whatsappService', () => ({ sendPropertyAlertWhatsApp: jest.fn().mockResolvedValue() }));

const { sequelize, PropertyAlert } = require('../../models/index');
const { notifyMatchingAlerts, sendAlertBatch } = require('../alertService');
const { sendPropertyAlertNotification } = require('../emailService');
const { sendPropertyAlertWhatsApp } = require('../whatsappService');

describe('alertService.notifyMatchingAlerts', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await PropertyAlert.destroy({ where: {}, force: true });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('matches por ciudad y tipo exactos', async () => {
    await PropertyAlert.create({ name: 'A', email: 'a@test.com', city: 'juarez', type: 'casa', isActive: true });
    await PropertyAlert.create({ name: 'B', email: 'b@test.com', city: 'chihuahua', type: 'casa', isActive: true });

    const matching = await notifyMatchingAlerts({ city: 'juarez', type: 'casa', price: 200000 });

    expect(matching).toHaveLength(1);
    expect(matching[0].email).toBe('a@test.com');
  });

  test('alerta con city/type null hace match con cualquier propiedad (criterio abierto)', async () => {
    await PropertyAlert.create({ name: 'C', email: 'c@test.com', city: null, type: null, isActive: true });

    const matching = await notifyMatchingAlerts({ city: 'queretaro', type: 'bodega', price: 50000 });

    expect(matching).toHaveLength(1);
    expect(matching[0].email).toBe('c@test.com');
  });

  test('respeta maxPrice', async () => {
    await PropertyAlert.create({ name: 'D', email: 'd@test.com', city: 'juarez', type: 'casa', maxPrice: 200000, isActive: true });

    const tooExpensive = await notifyMatchingAlerts({ city: 'juarez', type: 'casa', price: 300000 });
    expect(tooExpensive).toHaveLength(0);

    const withinBudget = await notifyMatchingAlerts({ city: 'juarez', type: 'casa', price: 150000 });
    expect(withinBudget).toHaveLength(1);
  });

  test('ignora alertas inactivas', async () => {
    await PropertyAlert.create({ name: 'E', email: 'e@test.com', city: 'juarez', type: 'casa', isActive: false });

    const matching = await notifyMatchingAlerts({ city: 'juarez', type: 'casa', price: 200000 });
    expect(matching).toHaveLength(0);
  });

  test('sendAlertBatch llama email para todos y WhatsApp solo si hay phone', async () => {
    const alerts = [
      { email: 'x@test.com', phone: null },
      { email: 'y@test.com', phone: '+526561234567' },
    ];

    await sendAlertBatch(alerts, { title: 'Casa de prueba' });

    expect(sendPropertyAlertNotification).toHaveBeenCalledTimes(2);
    expect(sendPropertyAlertWhatsApp).toHaveBeenCalledTimes(1);
    expect(sendPropertyAlertWhatsApp).toHaveBeenCalledWith(alerts[1], { title: 'Casa de prueba' });
  });
});
