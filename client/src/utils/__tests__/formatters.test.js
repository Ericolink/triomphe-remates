import { describe, it, expect } from 'vitest';
import { toWhatsAppLink } from '../formatters';

describe('toWhatsAppLink', () => {
  it('antepone 52 a un número mexicano de 10 dígitos', () => {
    expect(toWhatsAppLink('6561234567')).toBe('https://wa.me/526561234567');
  });

  it('preserva un número que ya incluye el prefijo 52', () => {
    expect(toWhatsAppLink('526561234567')).toBe('https://wa.me/526561234567');
  });

  it('sanitiza el símbolo + de un prefijo internacional', () => {
    expect(toWhatsAppLink('+526561234567')).toBe('https://wa.me/526561234567');
  });

  it('sanitiza espacios', () => {
    expect(toWhatsAppLink('656 123 4567')).toBe('https://wa.me/526561234567');
  });

  it('sanitiza guiones', () => {
    expect(toWhatsAppLink('656-123-4567')).toBe('https://wa.me/526561234567');
  });

  it('sanitiza paréntesis', () => {
    expect(toWhatsAppLink('(656) 123-4567')).toBe('https://wa.me/526561234567');
  });

  it('devuelve una URL base para un número vacío', () => {
    expect(toWhatsAppLink('')).toBe('https://wa.me/');
    expect(toWhatsAppLink(null)).toBe('https://wa.me/');
    expect(toWhatsAppLink(undefined)).toBe('https://wa.me/');
  });

  it('deja pasar dígitos tal cual cuando el número es inválido (ni 10 dígitos ni con prefijo)', () => {
    expect(toWhatsAppLink('12345')).toBe('https://wa.me/12345');
    expect(toWhatsAppLink('abc')).toBe('https://wa.me/');
  });

  it('agrega el mensaje como query string codificado cuando se provee', () => {
    expect(toWhatsAppLink('6561234567', 'Hola mundo')).toBe(
      'https://wa.me/526561234567?text=Hola%20mundo'
    );
  });

  it('no agrega query string cuando no se provee mensaje', () => {
    expect(toWhatsAppLink('6561234567')).not.toContain('?text=');
  });

  it('genera el mismo enlace para variantes equivalentes del mismo número', () => {
    const variants = [
      '6561234567',
      '526561234567',
      '+526561234567',
      '656 123 4567',
      '656-123-4567',
      '(656) 123-4567',
    ];
    const links = variants.map((v) => toWhatsAppLink(v));
    expect(new Set(links).size).toBe(1);
    expect(links[0]).toBe('https://wa.me/526561234567');
  });
});
