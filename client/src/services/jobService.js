import api from './api';

export const getPositions = async (params = {}) => {
  const { data } = await api.get('/jobs', { params });
  return data;
};

export const getPositionById = async (id) => {
  const { data } = await api.get(`/jobs/${id}`);
  return data;
};

export const applyToPosition = async (id, applicationData) => {
  const { data } = await api.post(`/jobs/${id}/apply`, applicationData);
  return data;
};

export const getAllPositions = async () => {
  const { data } = await api.get('/jobs/admin/all');
  return data;
};

export const createPosition = async (positionData) => {
  const { data } = await api.post('/jobs', positionData);
  return data;
};

export const updatePosition = async (id, positionData) => {
  const { data } = await api.put(`/jobs/${id}`, positionData);
  return data;
};

export const deletePosition = async (id) => {
  const { data } = await api.delete(`/jobs/${id}`);
  return data;
};

export const getApplications = async (params = {}) => {
  const { data } = await api.get('/jobs/applications', { params });
  return data;
};

export const updateApplication = async (id, applicationData) => {
  const { data } = await api.put(`/jobs/applications/${id}`, applicationData);
  return data;
};

export const deleteApplication = async (id) => {
  const { data } = await api.delete(`/jobs/applications/${id}`);
  return data;
};
