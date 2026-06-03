const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { Property, Image } = require('../models/index');

const cityLabel   = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const typeLabel   = { casa: 'Casa', departamento: 'Departamento', terreno: 'Terreno', local: 'Local', bodega: 'Bodega' };
const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };

const PRIMARY   = '#1a3a5c';
const ACCENT    = '#c8a96e';
const BG_ALT    = '#f0f4f8';
const TEXT      = '#374151';
const ST_GREEN  = '#10b981';
const ST_YELLOW = '#f59e0b';
const ST_RED    = '#ef4444';

const PRIMARY_ARGB   = 'FF1a3a5c';
const ACCENT_ARGB    = 'FFc8a96e';
const BG_ALT_ARGB    = 'FFf0f4f8';
const WHITE_ARGB     = 'FFFFFFFF';
const TEXT_ARGB      = 'FF374151';
const ST_GREEN_ARGB  = 'FF10b981';
const ST_YELLOW_ARGB = 'FFf59e0b';
const ST_RED_ARGB    = 'FFef4444';

const statusArgb = { disponible: ST_GREEN_ARGB, apartado: ST_YELLOW_ARGB, vendido: ST_RED_ARGB };
const statusHex  = { disponible: ST_GREEN,      apartado: ST_YELLOW,      vendido: ST_RED      };

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

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL
// ─────────────────────────────────────────────────────────────────────────────
const exportExcel = async (req, res) => {
  try {
    const properties = await getFilteredProperties(req.query);
    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inventario', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headers = [
      { header: '#',               key: 'num',                width: 5  },
      { header: 'Título',          key: 'title',              width: 34 },
      { header: 'Ciudad',          key: 'city',               width: 13 },
      { header: 'Tipo',            key: 'type',               width: 13 },
      { header: 'Estatus',         key: 'status',             width: 12 },
      { header: 'Precio',          key: 'price',              width: 17 },
      { header: 'M² Terreno',      key: 'terrainMeters',      width: 12 },
      { header: 'M² Construcción', key: 'constructionMeters', width: 16 },
      { header: 'Recámaras',       key: 'bedrooms',           width: 11 },
      { header: 'Baños',           key: 'bathrooms',          width: 9  },
      { header: 'Dirección',       key: 'address',            width: 28 },
      { header: 'Visitas',         key: 'views',              width: 9  },
      { header: 'Fecha alta',      key: 'createdAt',          width: 13 },
      { header: 'Última modif.',   key: 'updatedAt',          width: 13 },
    ];
    sheet.columns = headers;

    const LAST_COL = String.fromCharCode(64 + headers.length); // 'N'

    // Fila 1: fondo azul + logo blanco + título
    sheet.mergeCells(`A1:${LAST_COL}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = '                                         TRIOMPHE BIENES RAÍCES — Inventario de Remates Bancarios';
    titleCell.font  = { bold: true, size: 13, color: { argb: WHITE_ARGB } };
    titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_ARGB } };
    titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(1).height = 42;

    // Logo blanco en fila 1
    const logoPath = getLogoPath();
    if (logoPath) {
      try {
        const whiteBuf = await getWhiteLogoBuffer(logoPath);
        if (whiteBuf) {
          const logoId = workbook.addImage({ buffer: whiteBuf, extension: 'png' });
          sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 150, height: 40 } });
        }
      } catch { /* ignorado */ }
    }

    // Fila 2: subtítulo
    sheet.mergeCells(`A2:${LAST_COL}2`);
    const subCell = sheet.getCell('A2');
    subCell.value = `Generado el ${generatedAt}   ·   Total: ${properties.length} propiedades`;
    subCell.font  = { size: 9, italic: true, color: { argb: 'FF6b7280' } };
    subCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFe8eef4' } };
    subCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 18;

    // Fila 3: encabezados
    const headerRow = sheet.getRow(3);
    headerRow.values = headers.map((h) => h.header);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font      = { bold: true, color: { argb: WHITE_ARGB }, size: 9 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_ARGB } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border    = { bottom: { style: 'medium', color: { argb: ACCENT_ARGB } } };
    });

    // Datos
    properties.forEach((p, i) => {
      const isAlt = i % 2 === 0;
      const row = sheet.addRow({
        num:               i + 1,
        title:             dash(p.title),
        city:              cityLabel[p.city]     || p.city,
        type:              typeLabel[p.type]     || p.type,
        status:            statusLabel[p.status] || p.status,
        price:             formatPrice(p.price),
        terrainMeters:     p.terrainMeters       ? `${p.terrainMeters} m²`      : '—',
        constructionMeters:p.constructionMeters  ? `${p.constructionMeters} m²` : '—',
        bedrooms:          dash(p.bedrooms),
        bathrooms:         dash(p.bathrooms),
        address:           dash(p.address),
        views:             p.views ?? 0,
        createdAt:         formatDate(p.createdAt),
        updatedAt:         formatDate(p.updatedAt),
      });

      row.height = 18;
      row.eachCell((cell) => {
        cell.font      = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle' };
        cell.border    = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });

      row.getCell(5).font = { bold: true, size: 9, color: { argb: statusArgb[p.status] || TEXT_ARGB } };
      row.getCell(6).font = { bold: true, size: 9, color: { argb: PRIMARY_ARGB } };
    });

    // Fila total
    const totalRow = sheet.addRow({ num: '', title: `TOTAL: ${properties.length} propiedades` });
    totalRow.height = 20;
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_ARGB } };
    });
    totalRow.getCell(2).font = { bold: true, size: 10, color: { argb: PRIMARY_ARGB } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-inventario-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en exportExcel:', error);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────
const PDF_COLS = [
  { label: 'Título',         width: 140 },
  { label: 'Ciudad',         width: 62  },
  { label: 'Tipo',           width: 56  },
  { label: 'Estatus',        width: 62  },
  { label: 'Precio',         width: 85  },
  { label: 'M² Terreno',     width: 56  },
  { label: 'M² Constr.',     width: 56  },
  { label: 'Recámaras',      width: 50  },
  { label: 'Baños',          width: 40  },
  { label: 'Visitas',        width: 38  },
  { label: 'Alta',           width: 52  },
  { label: 'Modif.',         width: 52  },
];

const drawPDFHeader = async (doc, properties, generatedAt, logoPath) => {
  doc.rect(0, 0, doc.page.width, 72).fill(PRIMARY);

  // Logo blanco
  if (logoPath) {
    try {
      const whiteBuf = await getWhiteLogoBuffer(logoPath);
      if (whiteBuf) {
        doc.image(whiteBuf, 40, 12, { height: 48 });
      }
    } catch { /* ignorado */ }
  }

  doc.fillColor('white').fontSize(15).font('Helvetica-Bold')
    .text('TRIOMPHE BIENES RAÍCES', 168, 16);
  doc.fontSize(9).font('Helvetica')
    .text('Inventario de Remates Bancarios', 168, 35);
  doc.fontSize(7.5)
    .text(`Generado: ${generatedAt}`, 168, 51);

  doc.roundedRect(doc.page.width - 152, 20, 112, 32, 5).fill(ACCENT);
  doc.fillColor(PRIMARY).fontSize(9).font('Helvetica-Bold')
    .text(`${properties.length} propiedades`, doc.page.width - 148, 30, { width: 104, align: 'center' });
};

const drawPDFTableHeader = (doc, y) => {
  const pw = doc.page.width - 80;
  doc.rect(40, y, pw, 20).fill(PRIMARY);
  let x = 40;
  PDF_COLS.forEach((col) => {
    doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
      .text(col.label, x + 3, y + 6, { width: col.width - 6, ellipsis: true, lineBreak: false });
    x += col.width;
  });
  return y + 20;
};

const drawPDFFooter = (doc) => {
  doc.rect(0, doc.page.height - 32, doc.page.width, 32).fill(PRIMARY);
  doc.fillColor(ACCENT).fontSize(7).font('Helvetica')
    .text('© Triomphe Bienes Raíces — Documento generado automáticamente. Información sujeta a cambios sin previo aviso.',
      40, doc.page.height - 18, { width: doc.page.width - 80, align: 'center' });
};

const exportPDF = async (req, res) => {
  try {
    const properties = await getFilteredProperties(req.query);
    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-inventario-${Date.now()}.pdf`);
    doc.pipe(res);

    const logoPath = getLogoPath();

    await drawPDFHeader(doc, properties, generatedAt, logoPath);
    let y = drawPDFTableHeader(doc, 80);

    // Precalcular xPositions
    const xPositions = [];
    let acc = 40;
    PDF_COLS.forEach((c) => { xPositions.push(acc); acc += c.width; });

    for (let i = 0; i < properties.length; i++) {
      const p = properties[i];
      const ROW_H = 22;

      if (y + ROW_H > doc.page.height - 40) {
        drawPDFFooter(doc);
        doc.addPage({ layout: 'landscape' });
        await drawPDFHeader(doc, properties, generatedAt, logoPath);
        y = drawPDFTableHeader(doc, 80);
      }

      doc.rect(40, y, doc.page.width - 80, ROW_H).fill(i % 2 === 0 ? BG_ALT : '#ffffff');

      // Miniatura
      const imgPath = getFirstImagePath(p);
      let titleX = xPositions[0] + 3;
      let titleW = PDF_COLS[0].width - 6;
      if (imgPath) {
        try {
          const thumbSize = ROW_H - 3;
          doc.image(imgPath, xPositions[0] + 2, y + 1.5, { width: thumbSize, height: thumbSize });
          titleX = xPositions[0] + 2 + thumbSize + 2;
          titleW = PDF_COLS[0].width - thumbSize - 8;
        } catch { /* ignorado */ }
      }

      const rowData = [
        { val: dash(p.title),                                              col: 0, customX: titleX, customW: titleW },
        { val: cityLabel[p.city]   || p.city,                              col: 1 },
        { val: typeLabel[p.type]   || p.type,                              col: 2 },
        { val: statusLabel[p.status] || p.status,                          col: 3, isStatus: true },
        { val: formatPrice(p.price),                                       col: 4, bold: true, color: PRIMARY },
        { val: p.terrainMeters      ? `${p.terrainMeters} m²`    : '—',   col: 5 },
        { val: p.constructionMeters ? `${p.constructionMeters} m²` : '—', col: 6 },
        { val: dash(p.bedrooms),                                           col: 7 },
        { val: dash(p.bathrooms),                                          col: 8 },
        { val: String(p.views ?? 0),                                       col: 9 },
        { val: formatDate(p.createdAt),                                    col: 10 },
        { val: formatDate(p.updatedAt),                                    col: 11 },
      ];

      rowData.forEach(({ val, col, isStatus, bold, color, customX, customW }) => {
        const colDef = PDF_COLS[col];
        const xPos = customX !== undefined ? customX : xPositions[col] + 3;
        const wid  = customW !== undefined ? customW : colDef.width - 6;
        let fillColor = TEXT;
        if (isStatus) fillColor = statusHex[p.status] || TEXT;
        else if (color) fillColor = color;
        doc.fillColor(fillColor)
          .fontSize(7)
          .font(bold || isStatus ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, xPos, y + 7, { width: wid, ellipsis: true, lineBreak: false });
      });

      doc.moveTo(40, y + ROW_H).lineTo(doc.page.width - 40, y + ROW_H)
        .strokeColor('#e5e7eb').lineWidth(0.4).stroke();

      y += ROW_H;
    }

    drawPDFFooter(doc);
    doc.end();
  } catch (error) {
    console.error('Error en exportPDF:', error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
};

module.exports = { exportExcel, exportPDF };