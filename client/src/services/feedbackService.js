import api from './api';

export const createFeedback = async (feedbackData) => {
  const { data } = await api.post('/feedback', feedbackData);
  return data;
};

export const getFeedbacks = async (params = {}) => {
  const { data } = await api.get('/feedback', { params });
  return data;
};

export const updateFeedback = async (id, feedbackData) => {
  const { data } = await api.put(`/feedback/${id}`, feedbackData);
  return data;
};

export const deleteFeedback = async (id) => {
  const { data } = await api.delete(`/feedback/${id}`);
  return data;
};
