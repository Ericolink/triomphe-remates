const jwt = require('jsonwebtoken');
const { generateToken } = require('../helpers');

describe('generateToken', () => {
  const ORIGINAL_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    process.env.JWT_EXPIRES_IN = ORIGINAL_EXPIRES_IN;
  });

  test('con JWT_EXPIRES_IN definido (config válida), el token incluye el claim exp', () => {
    process.env.JWT_EXPIRES_IN = '7d';

    const token = generateToken({ id: 1, role: 'admin' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.exp).toBeDefined();
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  test('sin JWT_EXPIRES_IN, jwt.sign() falla en cada login/registro en vez de emitir un token sin exp', () => {
    // Con jsonwebtoken@9 la opción `expiresIn: undefined` no se ignora — falla la
    // validación de opciones ("expiresIn should be a number..."). authController atrapa
    // esto y responde 500 genérico en cada intento de login/registro/cambio de contraseña,
    // sin ninguna pista de que la causa real es una variable de entorno ausente. Por eso
    // validateEnvironment ahora exige JWT_EXPIRES_IN al boot: mejor un error claro al
    // arrancar que un 500 opaco repetido en cada request de auth.
    delete process.env.JWT_EXPIRES_IN;

    expect(() => generateToken({ id: 1, role: 'admin' })).toThrow(/expiresIn/);
  });
});
