import api from './api';
import { downloadBlob } from '../utils/download';

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

export const reorderImages = async (propertyId, imageIds) => {
  const { data } = await api.put(`/properties/${propertyId}/images/reorder`, { imageIds });
  return data;
};

// Revalida en un solo request los campos dinámicos (precio, status) de una
// lista de propiedades guardadas localmente. Usado por Favoritos/Comparador.
export const syncProperties = async (ids) => {
  if (!ids.length) return [];
  const { data } = await api.get('/properties/sync', { params: { ids: ids.join(',') } });
  return data.data;
};

export const getPropertyStats = async (params = {}) => {
  const { data } = await api.get('/properties/stats', { params });
  return data;
};

export const getPromotedProperty = async (params = {}) => {
  const { data } = await api.get('/properties/promoted', { params });
  return data;
};

export const promoteProperty = async (id) => {
  const { data } = await api.put(`/properties/${id}/promote`);
  return data;
};

export const getStatusHistory = async (id) => {
  const { data } = await api.get(`/properties/${id}/status-history`);
  return data;
};

export const getPriceHistory = async (id) => {
  const { data } = await api.get(`/properties/${id}/price-history`);
  return data;
};

export const trackView = async (id) => {
  await api.post(`/properties/${id}/view`);
};

export const trackShare = async (id) => {
  await api.post(`/properties/${id}/share`);
};

export const downloadPropertyQuotePDF = async (id, filename) => {
  const response = await api.get(`/export/property/${id}/pdf`, { responseType: 'blob' });
  downloadBlob(response.data, filename);
};
