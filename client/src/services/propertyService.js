import api from './api';

export const getProperties = async (params = {}) => {
  const { data } = await api.get('/properties', { params });
  return data;
};

export const getPropertyById = async (id) => {
  const { data } = await api.get(`/properties/${id}`);
  return data;
};

export const getPropertyBySlug = async (slug) => {
  const { data } = await api.get(`/properties/slug/${slug}`);
  return data;
};

export const createProperty = async (propertyData) => {
  const { data } = await api.post('/properties', propertyData);
  return data;
};

export const updateProperty = async (id, propertyData) => {
  const { data } = await api.put(`/properties/${id}`, propertyData);
  return data;
};

export const deleteProperty = async (id) => {
  const { data } = await api.delete(`/properties/${id}`);
  return data;
};

export const uploadImages = async (id, files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));
  const { data } = await api.post(`/properties/${id}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteImage = async (propertyId, imageId) => {
  const { data } = await api.delete(`/properties/${propertyId}/images/${imageId}`);
  return data;
};

export const setCoverImage = async (propertyId, imageId) => {
  const { data } = await api.put(`/properties/${propertyId}/images/${imageId}/cover`);
  return data;
};
