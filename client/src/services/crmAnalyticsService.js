import api from './api';

export const getCrmDashboard = async () => {
  const { data } = await api.get('/crm/dashboard');
  return data;
};

export const getCrmReports = async (params = {}) => {
  const { data } = await api.get('/crm/reports', { params });
  return data;
};
