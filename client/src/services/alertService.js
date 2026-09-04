import api from './api';

export const subscribe = async (data) => {
  const { data: res } = await api.post('/alerts', data);
  return res;
};

export const getAlerts = async (params = {}) => {
  const { data } = await api.get('/alerts', { params });
  return data;
};

export const deleteAlert = async (id) => {
  const { data } = await api.delete(`/alerts/${id}`);
  return data;
};

export const unsubscribeAlert = async (token) => {
  const { data } = await api.get('/alerts/unsubscribe', { params: { token } });
  return data;
};

export const getAlertByToken = async (token) => {
  const { data } = await api.get('/alerts/manage', { params: { token } });
  return data;
};

export const updateAlertByToken = async (token, criteria) => {
  const { data } = await api.put('/alerts/manage', criteria, { params: { token } });
  return data;
};
