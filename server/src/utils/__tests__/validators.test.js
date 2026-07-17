const { validateEmail, validatePhone } = require('../validators');

describe('validateEmail', () => {
  test('accepts a normal email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  test('rejects missing @ or domain', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
    expect(validateEmail('test@domain')).toBe(false);
  });

  test('rejects empty/null/non-string', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
  });
});

describe('validatePhone', () => {
  test('treats empty/null/undefined as valid (campo opcional)', () => {
    expect(validatePhone(null)).toBe(true);
    expect(validatePhone(undefined)).toBe(true);
    expect(validatePhone('')).toBe(true);
  });

  test('accepts 10 dígitos locales', () => {
    expect(validatePhone('6561234567')).toBe(true);
  });

  test('accepts con prefijo +52', () => {
    expect(validatePhone('+526561234567')).toBe(true);
  });

  test('accepts con prefijo 52 sin +', () => {
    expect(validatePhone('526561234567')).toBe(true);
  });

  test('accepts con espacios/guiones/paréntesis', () => {
    expect(validatePhone('(656) 123-4567')).toBe(true);
  });

  test('rejects formato inválido', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('abcdefghij')).toBe(false);
    expect(validatePhone('+55123456789')).toBe(false); // no es +52
  });

  test('rejects non-string', () => {
    expect(validatePhone(123456)).toBe(false);
  });
});
