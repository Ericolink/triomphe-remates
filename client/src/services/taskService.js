import api from './api';

export const getTasks = async (params = {}) => {
  const { data } = await api.get('/tasks', { params });
  return data;
};

export const getLeadTasks = async (leadId) => {
  const { data } = await api.get(`/leads/${leadId}/tasks`);
  return data;
};

export const completeTask = async (id, nextTaskData = {}) => {
  const { data } = await api.patch(`/tasks/${id}/complete`, nextTaskData);
  return data;
};

export const reassignTask = async (id, assignedToUserId) => {
  const { data } = await api.patch(`/tasks/${id}/reassign`, { assignedToUserId });
  return data;
};
