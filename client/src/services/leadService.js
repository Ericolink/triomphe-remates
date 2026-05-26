import api from './api';

export const createLead = async (leadData) => {
  const { data } = await api.post('/leads', leadData);
  return data;
};

export const getLeads = async (params = {}) => {
  const { data } = await api.get('/leads', { params });
  return data;
};

export const updateLead = async (id, leadData) => {
  const { data } = await api.put(`/leads/${id}`, leadData);
  return data;
};

export const deleteLead = async (id) => {
  const { data } = await api.delete(`/leads/${id}`);
  return data;
};
