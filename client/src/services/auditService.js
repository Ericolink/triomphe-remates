import api from './api';

export const getAuditLogs = async (params = {}) => {
  const { data } = await api.get('/audit', { params });
  return data;
};
