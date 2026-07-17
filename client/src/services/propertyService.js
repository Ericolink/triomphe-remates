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

export const getPropertyStats = async () => {
  const { data } = await api.get('/properties/stats');
  return data;
};

export const getPromotedProperty = async () => {
  const { data } = await api.get('/properties/promoted');
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

export const trackShare = async (id) => {
  await api.post(`/properties/${id}/share`);
};

export const getDocuments = async (id) => {
  const { data } = await api.get(`/properties/${id}/documents`);
  return data;
};

// AUDIT-007: panel admin necesita ver también los documentos privados
export const getAllDocuments = async (id) => {
  const { data } = await api.get(`/properties/${id}/documents/all`);
  return data;
};

export const uploadDocument = async (id, file, name, isPublic = true) => {
  const formData = new FormData();
  formData.append('file', file);
  if (name) formData.append('name', name);
  formData.append('isPublic', isPublic);
  const { data } = await api.post(`/properties/${id}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const setDocumentVisibility = async (propertyId, docId, isPublic) => {
  const { data } = await api.patch(`/properties/${propertyId}/documents/${docId}/visibility`, { isPublic });
  return data;
};

export const deleteDocument = async (propertyId, docId) => {
  const { data } = await api.delete(`/properties/${propertyId}/documents/${docId}`);
  return data;
};

export const downloadPropertyQuotePDF = async (id, filename) => {
  const response = await api.get(`/export/property/${id}/pdf`, { responseType: 'blob' });
  downloadBlob(response.data, filename);
};
