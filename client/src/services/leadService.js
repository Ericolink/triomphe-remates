import api from './api';

export const createLead = async (leadData) => {
  const { data } = await api.post('/leads', leadData);
  return data;
};

export const getLeads = async (params = {}) => {
  const { data } = await api.get('/leads', { params });
  return data;
};

export const getLeadById = async (id) => {
  const { data } = await api.get(`/leads/${id}`);
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

export const batchUpdateLeads = async (ids, pipelineStage) => {
  const { data } = await api.patch('/leads/batch', { ids, pipelineStage });
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

export const sendLeadWhatsApp = async (leadId, message) => {
  const { data } = await api.post(`/leads/${leadId}/whatsapp`, { message });
  return data;
};

// CRM Comercial
export const closeLeadAsWon = async (id, { propertyId, amount, closedAt }) => {
  const { data } = await api.put(`/leads/${id}/close-won`, { propertyId, amount, closedAt });
  return data;
};

export const closeLeadAsLost = async (id, { closeReason, closeReasonDetail }) => {
  const { data } = await api.put(`/leads/${id}/close-lost`, { closeReason, closeReasonDetail });
  return data;
};

export const addLeadProperty = async (leadId, propertyId) => {
  const { data } = await api.post(`/leads/${leadId}/properties`, { propertyId });
  return data;
};

export const removeLeadProperty = async (leadId, propertyId) => {
  const { data } = await api.delete(`/leads/${leadId}/properties/${propertyId}`);
  return data;
};
