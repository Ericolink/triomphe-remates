// AUDIT-017: helpers compartidos por las 5 funciones de exportController.js (formato,
// logo, imágenes, query base) — extraídos para que el controller solo contenga las
// rutas/handlers, no la lógica de soporte.
const path = require('path');
const fs = require('fs');
const { Property, Image } = require('../models/index');

const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') return 'PENDIENTE';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const dash = (val) => (val !== null && val !== undefined && val !== '') ? String(val) : '—';

const getLogoPath = () => {
  const candidates = [
    path.join(__dirname, '../../../client/public/logo.png'),
    path.join(__dirname, '../../client/public/logo.png'),
    path.join(__dirname, '../client/public/logo.png'),
    path.join(__dirname, '../../public/logo.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
};

// Logo blanco (brightness-0 invert) para fondos oscuros
const getWhiteLogoBuffer = async (logoPath) => {
  try {
    const { Jimp: JimpClass } = require('jimp');
    const img = await JimpClass.read(logoPath);
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const idx = (img.width * y + x) * 4;
        if (img.bitmap.data[idx + 3] > 10) {
          img.bitmap.data[idx]     = 255;
          img.bitmap.data[idx + 1] = 255;
          img.bitmap.data[idx + 2] = 255;
        }
      }
    }
    return await img.getBuffer('image/png');
  } catch (e) {
    console.error('Jimp error:', e.message);
    return null;
  }
};

const getFilteredProperties = async (query) => {
  const { city, type, status } = query;
  const where = {};
  if (city)   where.city   = city;
  if (type)   where.type   = type;
  if (status) where.status = status;

  return Property.findAll({
    where,
    order: [['city', 'ASC'], ['createdAt', 'DESC']],
    attributes: [
      'id', 'title', 'city', 'type', 'status', 'price',
      'squareMeters', 'terrainMeters', 'constructionMeters',
      'bedrooms', 'bathrooms', 'address',
      'views', 'createdAt', 'updatedAt',
    ],
    include: [{
      model: Image,
      as: 'images',
      attributes: ['url', 'isCover'],
      separate: true,
      order: [['isCover', 'DESC'], ['createdAt', 'ASC']],
      limit: 1,
    }],
  });
};

const getFirstImagePath = (property) => {
  const img = property.images?.[0];
  if (!img) return null;
  const base = path.join(__dirname, '../../../');
  const p = path.join(base, img.url);
  return fs.existsSync(p) ? p : null;
};

// Devuelve un buffer de imagen ya sea de una URL remota (Cloudinary) o un archivo local
const getImageBuffer = async (url) => {
  if (!url) return null;
  try {
    if (url.startsWith('http')) {
      const response = await fetch(url);
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    }
    const localPath = path.join(__dirname, '../../../', url);
    return fs.existsSync(localPath) ? fs.readFileSync(localPath) : null;
  } catch {
    return null;
  }
};

// Removes emoji and non-Latin-1 characters that Helvetica can't render
const stripUnsupported = (str) => {
  if (!str) return str;
  return str
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')   // Supplementary planes (emoji, symbols)
    .replace(/[\u{2600}-\u{27BF}]/gu, '')       // Misc symbols, dingbats
    .replace(/️/gu, '')                     // Emoji variation selector
    .replace(/‍/gu, '')                     // Zero-width joiner
    .replace(/\s+/g, ' ')
    .trim();
};

module.exports = {
  formatPrice, formatDate, dash,
  getLogoPath, getWhiteLogoBuffer, getFilteredProperties, getFirstImagePath, getImageBuffer,
  stripUnsupported,
};
