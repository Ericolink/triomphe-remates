import api from './api';

export const getWaitingList = async (params = {}) => {
  const { data } = await api.get('/waiting-list', { params });
  return data;
};

export const createWaitingListEntry = async (data) => {
  const { data: res } = await api.post('/waiting-list', data);
  return res;
};

export const updateWaitingListEntry = async (id, data) => {
  const { data: res } = await api.put(`/waiting-list/${id}`, data);
  return res;
};

export const deleteWaitingListEntry = async (id) => {
  const { data } = await api.delete(`/waiting-list/${id}`);
  return data;
};
