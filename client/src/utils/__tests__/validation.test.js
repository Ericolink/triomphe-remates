import { describe, it, expect } from 'vitest';
import { isInvalidOptionalAmount } from '../validation';

describe('isInvalidOptionalAmount', () => {
  it('no es inválido cuando el valor está vacío (el monto es opcional)', () => {
    expect(isInvalidOptionalAmount('')).toBe(false);
  });

  it('no es inválido cuando el valor tiene solo espacios', () => {
    expect(isInvalidOptionalAmount('   ')).toBe(false);
  });

  it('no es inválido para un número positivo', () => {
    expect(isInvalidOptionalAmount('50000')).toBe(false);
  });

  it('no es inválido para cero', () => {
    expect(isInvalidOptionalAmount('0')).toBe(false);
  });

  it('no es inválido para un número decimal', () => {
    expect(isInvalidOptionalAmount('1500.50')).toBe(false);
  });

  it('es inválido para un número negativo', () => {
    expect(isInvalidOptionalAmount('-100')).toBe(true);
  });

  it('es inválido para texto que no es numérico', () => {
    expect(isInvalidOptionalAmount('abc')).toBe(true);
  });

  it('es inválido para un valor mixto no numérico', () => {
    expect(isInvalidOptionalAmount('100abc')).toBe(true);
  });
});
