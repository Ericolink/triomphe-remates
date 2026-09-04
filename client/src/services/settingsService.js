import api from './api';

export const getInventoryDownloadSetting = async () => {
  const { data } = await api.get('/settings/inventory-download');
  return data;
};

export const updateInventoryDownloadSetting = async (enabled) => {
  const { data } = await api.put('/settings/inventory-download', { enabled });
  return data;
};

export const getPublicPropertiesSetting = async () => {
  const { data } = await api.get('/settings/public-properties');
  return data;
};

export const updatePublicPropertiesSetting = async (enabled) => {
  const { data } = await api.put('/settings/public-properties', { enabled });
  return data;
};
