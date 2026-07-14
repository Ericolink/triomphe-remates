import api from './api';

export const getDeals = async (params = {}) => {
  const { data } = await api.get('/deals', { params });
  return data;
};

export const getDealById = async (id) => {
  const { data } = await api.get(`/deals/${id}`);
  return data;
};
