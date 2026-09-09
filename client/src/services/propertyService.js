import api from './api';
import { getAnalyticsRequestContext } from '../utils/analytics';

// Compartida con el panel admin (PropertyPicker): ahí SÍ debe ir el JWT, para que el
// staff vea el inventario completo (incluye propiedades ocultas al público por
// publicPropertiesEnabled=false). Las páginas públicas deben usar getPublicProperties.
export const getProperties = async (params = {}) => {
  const { data } = await api.get('/properties', { params });
  return data;
};

// Igual que getProperties pero sin adjuntar el JWT — para las páginas públicas
// (HomePage, PropertiesPage, relacionadas en PropertyDetailPage). Sin esto, un visitante
// con una pestaña de /admin abierta en el mismo navegador (localStorage es por origen, no
// por pestaña) manda sin querer el token de esa sesión, el backend lo trata como staff
// (propertyController.getProperties: isStaff = Boolean(req.user)) y el toggle "Mostrar
// propiedades al público" deja de tener efecto para ese visitante — mismo patrón que
// createPublicLead vs createLead en leadService.js.
export const getPublicProperties = async (params = {}) => {
  const { data } = await api.get('/properties', { params, skipAuth: true });
  return data;
};

export const getPropertyById = async (id) => {
  const { data } = await api.get(`/properties/${id}`);
  return data;
};

// Solo usada por la ficha pública (PropertyDetailPage) — el panel admin usa
// getPropertyById. skipAuth: true por el mismo motivo que getPublicProperties.
export const getPropertyBySlug = async (slug) => {
  const { data } = await api.get(`/properties/slug/${slug}`, { skipAuth: true });
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
// lista de propiedades guardadas localmente. Usado por Favoritos/Comparador, ambos
// exclusivamente públicos — skipAuth: true por el mismo motivo que getPublicProperties.
export const syncProperties = async (ids) => {
  if (!ids.length) return [];
  const { data } = await api.get('/properties/sync', {
    params: { ids: ids.join(',') },
    skipAuth: true,
  });
  return data.data;
};

// Solo usada por páginas públicas (HomePage, AboutPage) — skipAuth: true por el mismo
// motivo que getPublicProperties.
export const getPropertyStats = async (params = {}) => {
  const { data } = await api.get('/properties/stats', { params, skipAuth: true });
  return data;
};

// Solo usada por HomePage — skipAuth: true por el mismo motivo que getPublicProperties.
export const getPromotedProperty = async (params = {}) => {
  const { data } = await api.get('/properties/promoted', { params, skipAuth: true });
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

export const trackView = async (id) => {
  await api.post(`/properties/${id}/view`, getAnalyticsRequestContext());
};

export const trackShare = async (id) => {
  await api.post(`/properties/${id}/share`, getAnalyticsRequestContext());
};
