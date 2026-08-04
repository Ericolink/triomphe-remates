import api from './api';

export const login = async (email, password) => {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data;
};

export const changePassword = async (currentPassword, newPassword) => {
  // skipAuthRedirect: un 401 aquí es "contraseña actual incorrecta", no una sesión
  // inválida — ver el interceptor en api.js.
  const { data } = await api.put(
    '/auth/change-password',
    { currentPassword, newPassword },
    { skipAuthRedirect: true }
  );
  return data;
};
