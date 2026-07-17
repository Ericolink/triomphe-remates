import api from './api';

export const getAppointments = async (params = {}) => {
  const { data } = await api.get('/appointments', { params });
  return data;
};

export const getLeadAppointments = async (leadId) => {
  const { data } = await api.get(`/leads/${leadId}/appointments`);
  return data;
};

export const createAppointment = async (appointmentData) => {
  const { data } = await api.post('/appointments', appointmentData);
  return data;
};

export const updateAppointmentStatus = async (id, statusData) => {
  const { data } = await api.patch(`/appointments/${id}`, statusData);
  return data;
};

export const rescheduleAppointment = async (id, { scheduledAt }) => {
  const { data } = await api.post(`/appointments/${id}/reschedule`, { scheduledAt });
  return data;
};

export const deleteAppointment = async (id) => {
  const { data } = await api.delete(`/appointments/${id}`);
  return data;
};
