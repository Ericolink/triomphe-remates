import api from './api';

export const getLeadActivities = async (leadId) => {
  const { data } = await api.get(`/leads/${leadId}/activities`);
  return data;
};

export const createLeadActivity = async (leadId, activityData) => {
  const { data } = await api.post(`/leads/${leadId}/activities`, activityData);
  return data;
};
