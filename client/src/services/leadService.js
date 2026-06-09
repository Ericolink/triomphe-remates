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

export const batchUpdateLeads = async (ids, status) => {
  const { data } = await api.patch('/leads/batch', { ids, status });
  return data;
};

export const batchDeleteLeads = async (ids) => {
  const { data } = await api.delete('/leads/batch', { data: { ids } });
  return data;
};

export const getLeadNotes = async (leadId) => {
  const { data } = await api.get(`/leads/${leadId}/notes`);
  return data;
};

export const addLeadNote = async (leadId, content) => {
  const { data } = await api.post(`/leads/${leadId}/notes`, { content });
  return data;
};

export const deleteLeadNote = async (leadId, noteId) => {
  const { data } = await api.delete(`/leads/${leadId}/notes/${noteId}`);
  return data;
};
