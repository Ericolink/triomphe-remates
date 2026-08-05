import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import api from '../api';

// El interceptor de respuesta de axios es el único punto centralizado que decide si un
// 401 cierra sesión (ver el comentario en api.js). Se invoca directamente el handler
// `rejected` registrado por interceptors.response.use — no hay forma de disparar este
// código haciendo un request real sin un servidor, y mockear axios completo probaría
// menos que esto.
const getRejectedHandler = () => api.interceptors.response.handlers[0].rejected;

const makeError = (status, data) => ({ response: { status, data } });

describe('interceptor de respuesta de api.js', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'some-token');
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('401 con code INVALID_SESSION: limpia la sesión y redirige a /admin/login', async () => {
    await expect(
      getRejectedHandler()(makeError(401, { error: 'Usuario no autorizado', code: 'INVALID_SESSION' }))
    ).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.href).toBe('/admin/login');
  });

  it('401 sin code (respuesta antigua/inesperada): se trata como sesión inválida por defecto', async () => {
    await expect(getRejectedHandler()(makeError(401, { error: 'No autorizado' }))).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/admin/login');
  });

  it('401 con code INVALID_CURRENT_PASSWORD: NO cierra sesión ni redirige', async () => {
    await expect(
      getRejectedHandler()(
        makeError(401, { error: 'Contraseña actual incorrecta', code: 'INVALID_CURRENT_PASSWORD' })
      )
    ).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBe('some-token');
    expect(localStorage.getItem('user')).not.toBeNull();
    expect(window.location.href).toBe('');
  });

  it('errores que no son 401 (ej. 400, 500) nunca cierran sesión', async () => {
    await expect(getRejectedHandler()(makeError(400, { error: 'Datos inválidos' }))).rejects.toBeTruthy();
    await expect(getRejectedHandler()(makeError(500, { error: 'Error interno' }))).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBe('some-token');
    expect(window.location.href).toBe('');
  });

  it('errores de red (sin response, ej. servidor caído) nunca cierran sesión', async () => {
    await expect(getRejectedHandler()(new Error('Network Error'))).rejects.toBeTruthy();

    expect(localStorage.getItem('token')).toBe('some-token');
    expect(window.location.href).toBe('');
  });
});
