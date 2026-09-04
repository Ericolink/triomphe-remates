import api from './api';

// Timeout propio (no el global de axios, que otras llamadas —exports, uploads— necesitan
// más holgado): si el backend tarda demasiado (ej. MySQL colgado), el request se aborta acá
// en vez de dejar al usuario esperando indefinidamente frente al botón "Ingresando...". Ver
// requestTimeout.js en el backend para el timeout equivalente del lado servidor.
const LOGIN_TIMEOUT_MS = 15000;

export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password }, { timeout: LOGIN_TIMEOUT_MS });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const changePassword = async (currentPassword, newPassword) => {
  const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
  return data;
};
