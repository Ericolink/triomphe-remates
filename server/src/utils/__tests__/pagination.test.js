const { sequelize, Property } = require('../../models/index');
const { paginate } = require('../pagination');

describe('paginate', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
    await Property.destroy({ where: {}, force: true });
    const rows = Array.from({ length: 25 }, (_, i) => ({
      title: `Propiedad de prueba ${i + 1}`,
      city: 'juarez',
      type: 'casa',
      price: 100000 + i * 1000,
      status: 'disponible',
    }));
    await Property.bulkCreate(rows);
  });

  afterAll(async () => {
    await Property.destroy({ where: {}, force: true });
    await sequelize.close();
  });

  test('primera página respeta el límite', async () => {
    const result = await paginate(Property, { page: 1, limit: 10, order: [['id', 'ASC']] });
    expect(result.data).toHaveLength(10);
    expect(result.pagination).toEqual({ total: 25, page: 1, limit: 10, totalPages: 3 });
  });

  test('última página devuelve el resto', async () => {
    const result = await paginate(Property, { page: 3, limit: 10, order: [['id', 'ASC']] });
    expect(result.data).toHaveLength(5);
    expect(result.pagination.page).toBe(3);
  });

  test('page/limit inválidos caen a su default (1/10)', async () => {
    const result = await paginate(Property, { page: 'no-numero', limit: 'no-numero' });
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(10);
  });

  test('respeta los filtros where', async () => {
    await Property.create({
      title: 'Única en Chihuahua',
      city: 'chihuahua',
      type: 'terreno',
      price: 50000,
      status: 'disponible',
    });
    const result = await paginate(Property, { page: 1, limit: 10, where: { city: 'chihuahua' } });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].city).toBe('chihuahua');
  });
});
