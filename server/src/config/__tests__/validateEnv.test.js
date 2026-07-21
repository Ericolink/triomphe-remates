const { validateEnvironment, validateJwtSecret, MIN_JWT_SECRET_LENGTH } = require('../validateEnv');

// 32 caracteres, sin patrones triviales ni repetición.
const STRONG_SECRET = 'Xk9mQ2pL7vN4wR8tY3zA6bC1dE5fG0hJ';

const baseEnv = () => ({
  DB_HOST: 'localhost',
  DB_USER: 'root',
  DB_NAME: 'triomphe_db',
  JWT_SECRET: STRONG_SECRET,
  JWT_EXPIRES_IN: '7d',
});

describe('validateEnvironment', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV, ...baseEnv() };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('una configuración válida no lanza y no advierte si todas las recomendadas están presentes', () => {
    Object.assign(process.env, {
      EMAIL_USER: 'a@a.com',
      EMAIL_PASS: 'x',
      EMAIL_TO: 'a@a.com',
      CLOUDINARY_CLOUD_NAME: 'x',
      CLOUDINARY_API_KEY: 'x',
      CLOUDINARY_API_SECRET: 'x',
      CLIENT_URL: 'http://localhost:5173',
      WHATSAPP_TOKEN: 'x',
      WHATSAPP_PHONE_NUMBER_ID: 'x',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => validateEnvironment()).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('JWT_SECRET demasiado corto detiene el arranque con un mensaje claro', () => {
    process.env.JWT_SECRET = 'corto123';

    expect(() => validateEnvironment()).toThrow(/JWT_SECRET inválido.*demasiado corto/s);
  });

  test('JWT_SECRET vacío se reporta como variable requerida ausente', () => {
    process.env.JWT_SECRET = '';

    expect(() => validateEnvironment()).toThrow(/Variables de entorno requeridas ausentes.*JWT_SECRET/);
  });

  test('JWT_SECRET ausente por completo se reporta como variable requerida ausente', () => {
    delete process.env.JWT_SECRET;

    expect(() => validateEnvironment()).toThrow(/Variables de entorno requeridas ausentes.*JWT_SECRET/);
  });

  test('JWT_EXPIRES_IN ausente detiene el arranque en vez de permitir tokens sin expiración', () => {
    delete process.env.JWT_EXPIRES_IN;

    expect(() => validateEnvironment()).toThrow(/Variables de entorno requeridas ausentes.*JWT_EXPIRES_IN/);
  });

  test('JWT_EXPIRES_IN definido junto a un JWT_SECRET fuerte arranca sin error', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => validateEnvironment()).not.toThrow();
    warnSpy.mockRestore();
  });

  test('múltiples errores de configuración simultáneos se reportan juntos en un solo mensaje', () => {
    delete process.env.DB_HOST;
    process.env.JWT_SECRET = 'corto';

    let thrown;
    try {
      validateEnvironment();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(thrown.message).toMatch(/DB_HOST/);
    expect(thrown.message).toMatch(/JWT_SECRET inválido/);
  });
});

describe('validateJwtSecret', () => {
  test('acepta un secreto largo, aleatorio y sin patrones triviales', () => {
    expect(validateJwtSecret(STRONG_SECRET)).toEqual([]);
  });

  test('rechaza secretos por debajo del mínimo, incluyendo el número de caracteres en el mensaje', () => {
    const errors = validateJwtSecret('short');
    expect(errors[0]).toContain(`(${'short'.length} caracteres, mínimo ${MIN_JWT_SECRET_LENGTH})`);
  });

  test('rechaza un secreto de un único carácter repetido aunque cumpla el largo mínimo', () => {
    const errors = validateJwtSecret('z'.repeat(MIN_JWT_SECRET_LENGTH));
    expect(errors.some((e) => /repetido/.test(e))).toBe(true);
  });

  test('el secreto real filtrado antes en web.config (AUDITORIA_CTO_EXTREMA.md) queda bloqueado', () => {
    const errors = validateJwtSecret('triomphe_jwt_super_secreto_2024');
    expect(errors.some((e) => /demasiado corto/.test(e))).toBe(true);
  });
});
