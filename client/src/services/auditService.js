import api from './api';

export const getAuditLogs = async (params = {}) => {
  const { data } = await api.get('/audit', { params });
  return data;
};

export const getAuditSummary = async (params = {}) => {
  const { data } = await api.get('/audit/summary', { params });
  return data;
};
