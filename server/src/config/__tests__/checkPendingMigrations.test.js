const fs = require('fs');
const { checkPendingMigrations } = require('../checkPendingMigrations');

jest.mock('../../utils/logger', () => ({ warn: jest.fn() }));

const MIGRATION_FILES = ['20260629000000-a.js', '20260629000001-b.js'];

describe('checkPendingMigrations', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(fs, 'readdirSync').mockReturnValue([...MIGRATION_FILES, 'not-a-migration.txt']);
  });

  test('no lanza si todas las migraciones ya están registradas en SequelizeMeta', async () => {
    const sequelize = {
      query: jest.fn().mockResolvedValue([MIGRATION_FILES.map((name) => ({ name }))]),
    };

    await expect(checkPendingMigrations(sequelize)).resolves.toBeUndefined();
  });

  test('lanza listando los archivos pendientes si SequelizeMeta tiene registros pero faltan algunos', async () => {
    const sequelize = {
      query: jest.fn().mockResolvedValue([[{ name: MIGRATION_FILES[0] }]]),
    };

    await expect(checkPendingMigrations(sequelize)).rejects.toThrow(MIGRATION_FILES[1]);
  });

  test('hace bootstrap de una base de datos nueva (SequelizeMeta no existe) sin lanzar', async () => {
    const error = new Error('Table does not exist');
    error.original = { code: 'ER_NO_SUCH_TABLE' };

    const createTable = jest.fn().mockResolvedValue();
    const bulkInsert = jest.fn().mockResolvedValue();
    const sequelize = {
      query: jest.fn().mockRejectedValue(error),
      getQueryInterface: () => ({ createTable, bulkInsert }),
    };

    await expect(checkPendingMigrations(sequelize)).resolves.toBeUndefined();

    expect(createTable).toHaveBeenCalledWith('SequelizeMeta', expect.any(Object));
    expect(bulkInsert).toHaveBeenCalledWith(
      'SequelizeMeta',
      MIGRATION_FILES.map((name) => ({ name }))
    );
  });

  test('vuelve a lanzar errores de base de datos que no sean "tabla inexistente"', async () => {
    const error = new Error('Connection lost');
    error.original = { code: 'ECONNRESET' };
    const sequelize = { query: jest.fn().mockRejectedValue(error) };

    await expect(checkPendingMigrations(sequelize)).rejects.toThrow('Connection lost');
  });
});
