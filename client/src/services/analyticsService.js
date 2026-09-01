import api from './api';

export const getDashboard = async () => {
  const { data } = await api.get('/analytics/dashboard');
  return data;
};

export const getPropertyAnalytics = async (id) => {
  const { data } = await api.get(`/analytics/properties/${id}`);
  return data;
};

export const getTrafficDashboard = async (params = {}) => {
  const { data } = await api.get('/analytics/traffic', { params });
  return data;
};
