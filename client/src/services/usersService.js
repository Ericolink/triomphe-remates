import api from './api';

export const getUsers = async () => {
  const { data } = await api.get('/users');
  return data;
};

export const createUser = async (userData) => {
  const { data } = await api.post('/users', userData);
  return data;
};

export const updateUser = async (id, formData) => {
  const { data } = await api.put(`/users/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deactivateUser = async (id) => {
  const { data } = await api.delete(`/users/${id}`);
  return data;
};

export const activateUser = async (id) => {
  const { data } = await api.put(`/users/${id}/activate`);
  return data;
};

export const permanentDeleteUser = async (id) => {
  const { data } = await api.delete(`/users/${id}/permanent`);
  return data;
};
