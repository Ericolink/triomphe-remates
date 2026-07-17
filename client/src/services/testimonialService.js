import api from './api';

export const getPublicTestimonials = async (params = {}) => {
  const { data } = await api.get('/testimonials/public', { params });
  return data;
};

export const getAllTestimonials = async (params = {}) => {
  const { data } = await api.get('/testimonials/admin/all', { params });
  return data;
};

export const getTestimonialById = async (id) => {
  const { data } = await api.get(`/testimonials/${id}`);
  return data;
};

export const createTestimonial = async (formData) => {
  const { data } = await api.post('/testimonials', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateTestimonial = async (id, formData) => {
  const { data } = await api.put(`/testimonials/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteTestimonial = async (id) => {
  const { data } = await api.delete(`/testimonials/${id}`);
  return data;
};
