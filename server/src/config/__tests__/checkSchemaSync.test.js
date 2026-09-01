const { checkSchemaSync } = require('../checkSchemaSync');

jest.mock('../../utils/logger', () => ({ error: jest.fn() }));

function fakeModel(tableName, attributeNames, indexes = []) {
  return {
    getTableName: () => tableName,
    rawAttributes: Object.fromEntries(attributeNames.map((name) => [name, {}])),
    options: { indexes },
  };
}

describe('checkSchemaSync', () => {
  test('no lanza si el esquema de la base de datos tiene todas las columnas que el modelo espera', async () => {
    const describeTable = jest.fn().mockResolvedValue({ id: {}, name: {}, phone: {} });
    const sequelize = { getQueryInterface: () => ({ describeTable }) };
    const model = fakeModel('leads', ['id', 'name', 'phone']);

    await expect(checkSchemaSync(sequelize, [model])).resolves.toBeUndefined();
  });

  test('lanza nombrando la tabla y las columnas exactas que faltan (mismo síntoma del incidente de producción: properties sin waterDebt/electricityDebt/propertyTaxDebt/debtsUpdateDate)', async () => {
    const describeTable = jest.fn().mockResolvedValue({
      id: {},
      title: {},
      // Falta waterDebt/electricityDebt/propertyTaxDebt/debtsUpdateDate — mismo escenario
      // real: la migración 20260828000000 nunca corrió contra esta base de datos.
    });
    const sequelize = { getQueryInterface: () => ({ describeTable }) };
    const model = fakeModel('properties', [
      'id',
      'title',
      'waterDebt',
      'electricityDebt',
      'propertyTaxDebt',
      'debtsUpdateDate',
    ]);

    await expect(checkSchemaSync(sequelize, [model])).rejects.toThrow(/properties/);
    await expect(checkSchemaSync(sequelize, [model])).rejects.toThrow(/waterDebt/);
    await expect(checkSchemaSync(sequelize, [model])).rejects.toThrow(/debtsUpdateDate/);
  });

  test('revisa todos los modelos, no se detiene en el primero que falla', async () => {
    const describeTable = jest.fn((tableName) =>
      tableName === 'leads' ? Promise.resolve({ id: {}, name: {} }) : Promise.resolve({ id: {} })
    );
    const sequelize = { getQueryInterface: () => ({ describeTable }) };
    const okModel = fakeModel('leads', ['id', 'name']);
    const brokenModel = fakeModel('properties', ['id', 'waterDebt']);

    await expect(checkSchemaSync(sequelize, [okModel, brokenModel])).rejects.toThrow('properties');
    expect(describeTable).toHaveBeenCalledWith('leads');
    expect(describeTable).toHaveBeenCalledWith('properties');
  });

  test('si no se puede leer el esquema de una tabla (ej. no existe), lo reporta con contexto en vez de lanzar un error críptico', async () => {
    const describeTable = jest.fn().mockRejectedValue(new Error('Table does not exist'));
    const sequelize = { getQueryInterface: () => ({ describeTable }) };
    const model = fakeModel('deals', ['id']);

    await expect(checkSchemaSync(sequelize, [model])).rejects.toThrow(/deals/);
    await expect(checkSchemaSync(sequelize, [model])).rejects.toThrow(/Table does not exist/);
  });

  test('detecta un índice declarado en el modelo que falta en la base de datos (el incidente real: idx_properties_fulltext_search)', async () => {
    const describeTable = jest.fn().mockResolvedValue({ id: {}, title: {}, address: {}, description: {} });
    // Índice ausente — mismo estado real encontrado en triomphe_test: SequelizeMeta lista
    // la migración como aplicada, pero el índice nunca se creó porque el bootstrap de una
    // BD nueva vía sync() solo mira los `indexes` del modelo, no las migraciones.
    const showIndex = jest.fn().mockResolvedValue([{ name: 'PRIMARY' }]);
    const sequelize = { getQueryInterface: () => ({ describeTable, showIndex }) };
    const model = fakeModel(
      'properties',
      ['id', 'title', 'address', 'description'],
      [{ fields: ['title', 'address', 'description'], type: 'FULLTEXT', name: 'idx_properties_fulltext_search' }]
    );

    await expect(checkSchemaSync(sequelize, [model])).rejects.toThrow(/idx_properties_fulltext_search/);
  });

  test('no lanza si el índice declarado en el modelo sí existe en la base de datos', async () => {
    const describeTable = jest.fn().mockResolvedValue({ id: {}, slug: {} });
    const showIndex = jest.fn().mockResolvedValue([{ name: 'PRIMARY' }, { name: 'properties_slug_unique' }]);
    const sequelize = { getQueryInterface: () => ({ describeTable, showIndex }) };
    const model = fakeModel('properties', ['id', 'slug'], [
      { unique: true, fields: ['slug'], name: 'properties_slug_unique' },
    ]);

    await expect(checkSchemaSync(sequelize, [model])).resolves.toBeUndefined();
  });
});
