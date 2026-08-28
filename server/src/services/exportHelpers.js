// AUDIT-017: helpers compartidos por las 5 funciones de exportController.js (formato,
// logo, imágenes, query base) — extraídos para que el controller solo contenga las
// rutas/handlers, no la lógica de soporte.
const path = require('path');
const fs = require('fs');
const { Property, Image } = require('../models/index');
const { PRIMARY_ARGB, ACCENT_ARGB, WHITE_ARGB } = require('./exportBranding');
const { formatPrice, formatDate } = require('../utils/formatters');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const dash = (val) => (val !== null && val !== undefined && val !== '' ? String(val) : '—');

// Convierte un índice de columna (1-based) a su letra de Excel (1→A, 26→Z, 27→AA...).
// buildExcelHeader antes calculaba esto con `String.fromCharCode(64 + n)`, que solo es
// correcto hasta 26 columnas — con más (ver exportExcel de propiedades, que pasó a tener
// 35 tras agregar los campos de seguimiento de inventario) devolvía un carácter minúsculo
// fuera de rango en vez de "AI", rompiendo el merge/referencia de celda.
const columnLetter = (n) => {
  let s = '';
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
};

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
          img.bitmap.data[idx] = 255;
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

// Filas 1-3 compartidas por las exportaciones Excel: título+logo, subtítulo y
// encabezado de columnas. Solo el texto de título/subtítulo y las columnas cambian
// entre reportes — el resto (colores, tamaños, alturas) es idéntico en los tres.
const buildExcelHeader = async ({ workbook, sheet, headers, title, subtitle }) => {
  const LAST_COL = columnLetter(headers.length);

  // Fila 1: fondo azul + logo blanco + título
  sheet.mergeCells(`A1:${LAST_COL}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 13, color: { argb: WHITE_ARGB } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_ARGB } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
  sheet.getRow(1).height = 42;

  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      const whiteBuf = await getWhiteLogoBuffer(logoPath);
      if (whiteBuf) {
        const logoId = workbook.addImage({ buffer: whiteBuf, extension: 'png' });
        sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 40 } });
      }
    } catch {
      /* ignorado */
    }
  }

  // Fila 2: subtítulo
  sheet.mergeCells(`A2:${LAST_COL}2`);
  const subCell = sheet.getCell('A2');
  subCell.value = subtitle;
  subCell.font = { size: 9, italic: true, color: { argb: 'FF6b7280' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8eef4' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 18;

  // Fila 3: encabezados de columna
  const headerRow = sheet.getRow(3);
  headerRow.values = headers.map((h) => h.header);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE_ARGB }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_ARGB } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: ACCENT_ARGB } } };
  });
};

const getFilteredProperties = async (query) => {
  const { city, type, category, status } = query;
  const where = {};
  if (city) where.city = city;
  if (type) where.type = type;
  if (category) where.category = category;
  if (status) where.status = status;

  return Property.findAll({
    where,
    order: [
      ['city', 'ASC'],
      ['createdAt', 'DESC'],
    ],
    attributes: [
      'id',
      'title',
      'city',
      'type',
      'status',
      'price',
      'squareMeters',
      'terrainMeters',
      'constructionMeters',
      'bedrooms',
      'bathrooms',
      'address',
      'views',
      'createdAt',
      'updatedAt',
      // Campos de seguimiento de inventario — usados por exportExcel (ver
      // exportController.js); se agregan aquí porque este query es compartido con exportPDF,
      // que simplemente no los referencia en su propio mapeo de columnas.
      'propertyNumber',
      'colonia',
      'postalCode',
      'code',
      'internalNotes',
      'lot',
      'block',
      'portfolio',
      'legalProcessType',
      'zone',
      'waterDebt',
      'electricityDebt',
      'propertyTaxDebt',
      'debtsUpdateDate',
      'commercialPrice1',
      'commercialPrice1Date',
      'commercialPrice2',
      'commercialPrice2Date',
      'utility',
      'inventoryEntryDate',
    ],
    include: [
      {
        model: Image,
        as: 'images',
        attributes: ['url', 'isCover'],
        separate: true,
        order: [
          ['isCover', 'DESC'],
          ['createdAt', 'ASC'],
        ],
        limit: 1,
      },
    ],
  });
};

// Inserta una transformación Cloudinary de recorte cuadrado (mismo criterio que
// buildImageUrl en client/src/utils/images.js, pero forzando f_jpg en vez de f_auto: tanto
// ExcelJS (workbook.addImage) como PDFKit (doc.image) solo soportan JPEG/PNG — f_auto podría
// resolver a WebP y romper el embed en ambos formatos de exportación). c_fill con w=h
// devuelve ya recortado a cuadrado, así el thumbnail no sale distorsionado al forzar el
// mismo width/height del lado de ExcelJS/PDFKit.
const buildThumbnailUrl = (url, size = 80) => {
  if (!url || !url.startsWith('http') || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/f_jpg,q_auto,c_fill,w_${size},h_${size}/`);
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
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '') // Supplementary planes (emoji, symbols)
    .replace(/[\u{2600}-\u{27BF}]/gu, '') // Misc symbols, dingbats
    .replace(/️/gu, '') // Emoji variation selector
    .replace(/‍/gu, '') // Zero-width joiner
    .replace(/\s+/g, ' ')
    .trim();
};

// Manejo de error unificado para los endpoints de exportación (exportExcel, exportPDF,
// exportFeedbackExcel, exportLeadsExcel, entre otros). Todos generan el archivo
// escribiendo directo a `res` en streaming (ExcelJS vía workbook.xlsx.write(res), pdfkit vía
// doc.pipe(res)) — una vez que salió el primer chunk, res.headersSent queda en true y Node
// revienta con ERR_HTTP_HEADERS_SENT en cuanto algo (p.ej. res.json()) intenta volver a
// llamar res.setHeader(). Por eso la respuesta de error solo es segura mientras
// headersSent siga en false; si ya se envió, lo único seguro es loguear y cortar la
// conexión — no hay forma de "corregir" un archivo que el cliente ya empezó a recibir.
const handleExportError = (req, res, error, fallbackMessage) => {
  const meta = {
    message: error.message,
    userId: req.user?.id || 'anonymous',
    stack: error.stack,
  };

  if (res.headersSent) {
    logger.error(`${req.method} ${req.originalUrl} (stream ya iniciado)`, meta);
    // res.end() es inseguro aquí: pdfkit/ExcelJS pueden seguir escribiendo chunks ya
    // encolados internamente y un "write after end" sobre `res` lanza un 'error' sin
    // listener, lo que tumba el proceso. destroy() cierra el socket de inmediato y hace
    // que Node desenganche (unpipe) la fuente automáticamente al detectar el cierre.
    res.destroy();
    return;
  }

  if (error instanceof ApiError) {
    logger.error(`${req.method} ${req.originalUrl}`, { ...meta, statusCode: error.statusCode });
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  logger.error(`${req.method} ${req.originalUrl}`, meta);
  res.status(500).json({ error: fallbackMessage });
};

module.exports = {
  formatPrice,
  formatDate,
  dash,
  getLogoPath,
  getWhiteLogoBuffer,
  buildExcelHeader,
  getFilteredProperties,
  getImageBuffer,
  buildThumbnailUrl,
  stripUnsupported,
  handleExportError,
};
