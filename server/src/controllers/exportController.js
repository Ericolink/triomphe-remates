const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Property, Image, Feedback, Lead } = require('../models/index');
const {
  CITY_LABEL: cityLabel,
  PROPERTY_TYPE_LABEL: typeLabel,
  STATUS_LABEL: statusLabel,
  CITY_STATE_LABEL: stateLabel,
  LEAD_TYPE_LABEL: leadTypeLabel,
} = require('../utils/labels');
const { logAudit } = require('../utils/audit');

// AUDIT-017: paleta de marca y helpers compartidos extraídos a services/ — este archivo
// ahora solo contiene las 5 rutas/handlers que routes/export.js espera (mismo shape de
// exports que antes, sin convertirlo en Router).
const {
  PRIMARY,
  ACCENT,
  BG_ALT,
  TEXT,
  PRIMARY_ARGB,
  ACCENT_ARGB,
  BG_ALT_ARGB,
  TEXT_ARGB,
  ST_GREEN_ARGB,
  ST_YELLOW_ARGB,
  statusArgb,
  statusHex,
  COMPANY_PHONE,
  COMPANY_WHATSAPP,
  COMPANY_EMAIL,
  COMPANY_ADDRESS,
} = require('../services/exportBranding');
const {
  formatPrice,
  formatDate,
  dash,
  getLogoPath,
  getWhiteLogoBuffer,
  buildExcelHeader,
  getFilteredProperties,
  getFirstImagePath,
  getImageBuffer,
  stripUnsupported,
} = require('../services/exportHelpers');

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL
// ─────────────────────────────────────────────────────────────────────────────
const exportExcel = async (req, res) => {
  try {
    const properties = await getFilteredProperties(req.query);
    logAudit(req, 'export', 'property', null, {
      format: 'excel',
      count: properties.length,
      query: req.query,
    });
    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inventario', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Título', key: 'title', width: 34 },
      { header: 'Ciudad', key: 'city', width: 13 },
      { header: 'Tipo', key: 'type', width: 13 },
      { header: 'Estatus', key: 'status', width: 12 },
      { header: 'Precio', key: 'price', width: 17 },
      { header: 'M² Terreno', key: 'terrainMeters', width: 12 },
      { header: 'M² Construcción', key: 'constructionMeters', width: 16 },
      { header: 'Recámaras', key: 'bedrooms', width: 11 },
      { header: 'Baños', key: 'bathrooms', width: 9 },
      { header: 'Dirección', key: 'address', width: 28 },
      { header: 'Visitas', key: 'views', width: 9 },
      { header: 'Fecha alta', key: 'createdAt', width: 13 },
      { header: 'Última modif.', key: 'updatedAt', width: 13 },
    ];
    sheet.columns = headers;

    await buildExcelHeader({
      workbook,
      sheet,
      headers,
      title:
        '                                         TRIOMPHE BIENES RAÍCES — Inventario de Remates Bancarios',
      subtitle: `Generado el ${generatedAt}   ·   Total: ${properties.length} propiedades`,
    });

    // Datos
    properties.forEach((p, i) => {
      const isAlt = i % 2 === 0;
      const row = sheet.addRow({
        num: i + 1,
        title: dash(p.title),
        city: cityLabel[p.city] || p.city,
        type: typeLabel[p.type] || p.type,
        status: statusLabel[p.status] || p.status,
        price: formatPrice(p.price),
        terrainMeters: p.terrainMeters ? `${p.terrainMeters} m²` : '—',
        constructionMeters: p.constructionMeters ? `${p.constructionMeters} m²` : '—',
        bedrooms: dash(p.bedrooms),
        bathrooms: dash(p.bathrooms),
        address: dash(p.address),
        views: p.views ?? 0,
        createdAt: formatDate(p.createdAt),
        updatedAt: formatDate(p.updatedAt),
      });

      row.height = 18;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });

      row.getCell(5).font = {
        bold: true,
        size: 9,
        color: { argb: statusArgb[p.status] || TEXT_ARGB },
      };
      row.getCell(6).font = { bold: true, size: 9, color: { argb: PRIMARY_ARGB } };
    });

    // Fila total
    const totalRow = sheet.addRow({ num: '', title: `TOTAL: ${properties.length} propiedades` });
    totalRow.height = 20;
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_ARGB } };
    });
    totalRow.getCell(2).font = { bold: true, size: 10, color: { argb: PRIMARY_ARGB } };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=triomphe-inventario-${Date.now()}.xlsx`
    );
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
  { label: 'Título', width: 140 },
  { label: 'Ciudad', width: 62 },
  { label: 'Tipo', width: 56 },
  { label: 'Estatus', width: 62 },
  { label: 'Precio', width: 85 },
  { label: 'M² Terreno', width: 56 },
  { label: 'M² Constr.', width: 56 },
  { label: 'Recámaras', width: 50 },
  { label: 'Baños', width: 40 },
  { label: 'Visitas', width: 38 },
  { label: 'Alta', width: 52 },
  { label: 'Modif.', width: 52 },
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
    } catch {
      /* ignorado */
    }
  }

  doc
    .fillColor('white')
    .fontSize(15)
    .font('Helvetica-Bold')
    .text('TRIOMPHE BIENES RAÍCES', 168, 16);
  doc.fontSize(9).font('Helvetica').text('Inventario de Remates Bancarios', 168, 35);
  doc.fontSize(7.5).text(`Generado: ${generatedAt}`, 168, 51);

  doc.roundedRect(doc.page.width - 152, 20, 112, 32, 5).fill(ACCENT);
  doc
    .fillColor(PRIMARY)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`${properties.length} propiedades`, doc.page.width - 148, 30, {
      width: 104,
      align: 'center',
    });
};

const drawPDFTableHeader = (doc, y) => {
  const pw = doc.page.width - 80;
  doc.rect(40, y, pw, 20).fill(PRIMARY);
  let x = 40;
  PDF_COLS.forEach((col) => {
    doc
      .fillColor('white')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(col.label, x + 3, y + 6, { width: col.width - 6, ellipsis: true, lineBreak: false });
    x += col.width;
  });
  return y + 20;
};

const drawPDFFooter = (doc) => {
  doc.rect(0, doc.page.height - 32, doc.page.width, 32).fill(PRIMARY);
  doc
    .fillColor(ACCENT)
    .fontSize(7)
    .font('Helvetica')
    .text(
      '© Triomphe Bienes Raíces — Documento generado automáticamente. Información sujeta a cambios sin previo aviso.',
      40,
      doc.page.height - 18,
      { width: doc.page.width - 80, align: 'center' }
    );
};

const exportPDF = async (req, res) => {
  try {
    const properties = await getFilteredProperties(req.query);
    logAudit(req, 'export', 'property', null, {
      format: 'pdf',
      count: properties.length,
      query: req.query,
    });
    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=triomphe-inventario-${Date.now()}.pdf`
    );
    doc.pipe(res);

    const logoPath = getLogoPath();

    await drawPDFHeader(doc, properties, generatedAt, logoPath);
    let y = drawPDFTableHeader(doc, 80);

    // Precalcular xPositions
    const xPositions = [];
    let acc = 40;
    PDF_COLS.forEach((c) => {
      xPositions.push(acc);
      acc += c.width;
    });

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
        } catch {
          /* ignorado */
        }
      }

      const rowData = [
        { val: dash(p.title), col: 0, customX: titleX, customW: titleW },
        { val: cityLabel[p.city] || p.city, col: 1 },
        { val: typeLabel[p.type] || p.type, col: 2 },
        { val: statusLabel[p.status] || p.status, col: 3, isStatus: true },
        { val: formatPrice(p.price), col: 4, bold: true, color: PRIMARY },
        { val: p.terrainMeters ? `${p.terrainMeters} m²` : '—', col: 5 },
        { val: p.constructionMeters ? `${p.constructionMeters} m²` : '—', col: 6 },
        { val: dash(p.bedrooms), col: 7 },
        { val: dash(p.bathrooms), col: 8 },
        { val: String(p.views ?? 0), col: 9 },
        { val: formatDate(p.createdAt), col: 10 },
        { val: formatDate(p.updatedAt), col: 11 },
      ];

      rowData.forEach(({ val, col, isStatus, bold, color, customX, customW }) => {
        const colDef = PDF_COLS[col];
        const xPos = customX !== undefined ? customX : xPositions[col] + 3;
        const wid = customW !== undefined ? customW : colDef.width - 6;
        let fillColor = TEXT;
        if (isStatus) fillColor = statusHex[p.status] || TEXT;
        else if (color) fillColor = color;
        doc
          .fillColor(fillColor)
          .fontSize(7)
          .font(bold || isStatus ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, xPos, y + 7, { width: wid, ellipsis: true, lineBreak: false });
      });

      doc
        .moveTo(40, y + ROW_H)
        .lineTo(doc.page.width - 40, y + ROW_H)
        .strokeColor('#e5e7eb')
        .lineWidth(0.4)
        .stroke();

      y += ROW_H;
    }

    drawPDFFooter(doc);
    doc.end();
  } catch (error) {
    console.error('Error en exportPDF:', error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL — Buzón de feedback
// ─────────────────────────────────────────────────────────────────────────────
const categoryLabel = { queja: 'Queja', comentario: 'Comentario', sugerencia: 'Sugerencia' };
const feedbackStatusLabel = { nuevo: 'Nuevo', leido: 'Leído', archivado: 'Archivado' };

const exportFeedbackExcel = async (req, res) => {
  try {
    const { status, category } = req.query;
    const where = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const items = await Feedback.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    logAudit(req, 'export', 'feedback', null, {
      format: 'excel',
      count: items.length,
      query: req.query,
    });

    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Buzón', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Categoría', key: 'category', width: 13 },
      { header: 'Nombre', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Asunto', key: 'subject', width: 36 },
      { header: 'Mensaje', key: 'message', width: 50 },
      { header: 'Estatus', key: 'status', width: 12 },
      { header: 'Notas', key: 'notes', width: 30 },
      { header: 'Fecha', key: 'createdAt', width: 16 },
    ];
    sheet.columns = headers;

    await buildExcelHeader({
      workbook,
      sheet,
      headers,
      title:
        '                                         TRIOMPHE BIENES RAÍCES — Buzón de Opiniones',
      subtitle: `Generado el ${generatedAt}   ·   Total: ${items.length} mensajes`,
    });

    const categoryArgb = { queja: 'FFEF4444', comentario: 'FF3B82F6', sugerencia: 'FF10B981' };
    const statusArgbFeedback = { nuevo: 'FF3B82F6', leido: ST_YELLOW_ARGB, archivado: 'FF9CA3AF' };

    items.forEach((item, i) => {
      const isAlt = i % 2 === 0;
      const row = sheet.addRow({
        num: i + 1,
        category: categoryLabel[item.category] || item.category,
        name: dash(item.name),
        email: dash(item.email),
        subject: dash(item.subject),
        message: item.message ? item.message.slice(0, 200) : '—',
        status: feedbackStatusLabel[item.status] || item.status,
        notes: dash(item.notes),
        createdAt: formatDate(item.createdAt),
      });

      row.height = 18;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });

      row.getCell(2).font = {
        bold: true,
        size: 9,
        color: { argb: categoryArgb[item.category] || TEXT_ARGB },
      };
      row.getCell(7).font = {
        bold: true,
        size: 9,
        color: { argb: statusArgbFeedback[item.status] || TEXT_ARGB },
      };
    });

    // Fila total
    const totalRow = sheet.addRow({ num: '', name: `TOTAL: ${items.length} mensajes` });
    totalRow.height = 20;
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_ARGB } };
    });
    totalRow.getCell(3).font = { bold: true, size: 10, color: { argb: PRIMARY_ARGB } };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-buzon-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en exportFeedbackExcel:', error);
    res.status(500).json({ error: 'Error al generar Excel del buzón' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL — Leads
// ─────────────────────────────────────────────────────────────────────────────
const leadStatusLabel = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cerrado: 'Cerrado',
  descartado: 'Descartado',
};
const leadStatusArgb = {
  nuevo: 'FF3B82F6',
  contactado: ST_YELLOW_ARGB,
  cerrado: ST_GREEN_ARGB,
  descartado: 'FF9CA3AF',
};
const paymentMethodLabel = { credito_hipotecario: 'Crédito hipotecario', contado: 'Contado' };

const exportLeadsExcel = async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const leads = await Lead.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: Property, as: 'property', attributes: ['title'] }],
    });
    logAudit(req, 'export', 'lead', null, {
      format: 'excel',
      count: leads.length,
      query: req.query,
    });

    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Leads', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Nombre', key: 'name', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Propiedad', key: 'property', width: 30 },
      { header: 'Tipo', key: 'type', width: 13 },
      { header: 'Estatus', key: 'status', width: 13 },
      { header: 'Forma de pago', key: 'paymentMethod', width: 18 },
      { header: 'Monto disponible', key: 'budgetAmount', width: 18 },
      { header: 'Primer contacto', key: 'firstContactDate', width: 16 },
      { header: 'Fecha de cita', key: 'appointmentDate', width: 16 },
      { header: 'Mensaje', key: 'message', width: 40 },
      { header: 'Notas', key: 'notes', width: 30 },
      { header: 'Fecha', key: 'createdAt', width: 16 },
    ];
    sheet.columns = headers;

    await buildExcelHeader({
      workbook,
      sheet,
      headers,
      title: '                                         TRIOMPHE BIENES RAÍCES — Leads',
      subtitle: `Generado el ${generatedAt}   ·   Total: ${leads.length} leads`,
    });

    leads.forEach((lead, i) => {
      const isAlt = i % 2 === 0;
      const row = sheet.addRow({
        num: i + 1,
        name: dash(lead.name),
        email: dash(lead.email),
        phone: dash(lead.phone),
        property: dash(lead.property?.title),
        type: leadTypeLabel[lead.type] || lead.type,
        status: leadStatusLabel[lead.status] || lead.status,
        paymentMethod: lead.paymentMethod
          ? paymentMethodLabel[lead.paymentMethod] || lead.paymentMethod
          : '—',
        budgetAmount: lead.budgetNotSpecified
          ? 'No especificó'
          : lead.budgetAmount != null
            ? formatPrice(lead.budgetAmount)
            : '—',
        firstContactDate: lead.firstContactDate ? formatDate(lead.firstContactDate) : '—',
        appointmentDate: lead.appointmentDate ? formatDate(lead.appointmentDate) : '—',
        message: lead.message ? lead.message.slice(0, 200) : '—',
        notes: dash(lead.notes),
        createdAt: formatDate(lead.createdAt),
      });

      row.height = 18;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });

      row.getCell(7).font = {
        bold: true,
        size: 9,
        color: { argb: leadStatusArgb[lead.status] || TEXT_ARGB },
      };
    });

    // Fila total
    const totalRow = sheet.addRow({ num: '', name: `TOTAL: ${leads.length} leads` });
    totalRow.height = 20;
    totalRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT_ARGB } };
    });
    totalRow.getCell(2).font = { bold: true, size: 10, color: { argb: PRIMARY_ARGB } };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-leads-${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en exportLeadsExcel:', error);
    res.status(500).json({ error: 'Error al generar Excel de leads' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF — Cotización / ficha de propiedad
// ─────────────────────────────────────────────────────────────────────────────
// Bloque de fondo BG_ALT con filas label:value en cuadrícula — comparten el mismo
// lenguaje visual "Ubicación"/"Características" en vez de las pastillas de ancho
// variable de antes (se envolvían de forma impredecible y desperdiciaban ancho).
// `rows` ya debe venir filtrado (sin entradas vacías) — el orden se preserva tal cual
// al recorrer la cuadrícula fila por fila, columna por columna.
const drawInfoBox = (doc, { x, y, width, title, rows, columns }) => {
  if (!rows.length) return y;

  const PAD = 10;
  const ROW_H = 28;
  const TITLE_H = 18;
  const gridRows = Math.ceil(rows.length / columns);
  const colWidth = (width - PAD * 2) / columns;
  const boxH = PAD * 2 + TITLE_H + gridRows * ROW_H;

  doc.roundedRect(x, y, width, boxH, 8).fill(BG_ALT);
  doc
    .fillColor(ACCENT)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(title.toUpperCase(), x + PAD, y + PAD - 2, { characterSpacing: 0.4 });

  rows.forEach((row, i) => {
    const col = i % columns;
    const gridRow = Math.floor(i / columns);
    const cx = x + PAD + col * colWidth;
    const cy = y + PAD + TITLE_H + gridRow * ROW_H;
    doc
      .fillColor('#6b7280')
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(row.label.toUpperCase(), cx, cy, {
        width: colWidth - 10,
        characterSpacing: 0.3,
        lineBreak: false,
      });
    doc
      .fillColor(TEXT)
      .fontSize(11)
      .font('Helvetica')
      .text(row.value, cx, cy + 12, { width: colWidth - 10, ellipsis: true, lineBreak: false });
  });

  return y + boxH + 10;
};

// Pie institucional — se dibuja en CADA página (antes solo aparecía en la última, si la
// descripción larga de una propiedad forzaba un salto de página, la primera se quedaba
// sin datos de contacto). Dos columnas para aprovechar el ancho completo del pie.
const drawQuoteFooter = (doc, PW, MX, FOOTER_H) => {
  const top = doc.page.height - FOOTER_H;
  const colW = (PW - MX * 2) / 2;

  doc.rect(0, top, PW, FOOTER_H).fill(PRIMARY);

  doc
    .fillColor(ACCENT)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('¿Te interesa esta propiedad? Contáctanos:', MX, top + 14, { width: colW });
  doc
    .fillColor('white')
    .fontSize(9.5)
    .font('Helvetica')
    .text(`Tel / WhatsApp: ${COMPANY_PHONE}`, MX, top + 34, { width: colW })
    .text(`Email: ${COMPANY_EMAIL}`, MX, top + 50, { width: colW });

  doc
    .fillColor(ACCENT)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('Oficinas', MX + colW, top + 14, { width: colW });
  doc
    .fillColor('white')
    .fontSize(9)
    .font('Helvetica')
    .text(COMPANY_ADDRESS, MX + colW, top + 30, { width: colW, lineGap: 1 })
    .text(`https://wa.me/${COMPANY_WHATSAPP}`, MX + colW, top + 58, { width: colW });

  doc
    .fillColor(ACCENT)
    .fontSize(7)
    .font('Helvetica')
    .text(
      '© Triomphe Bienes Raíces — Documento informativo. Precio e información sujetos a cambios sin previo aviso.',
      MX,
      doc.page.height - 14,
      { width: PW - MX * 2, align: 'center' }
    );
};

const exportPropertyQuotePDF = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id, {
      attributes: { exclude: ['internalNotes'] },
      include: [{ model: Image, as: 'images', order: [['order', 'ASC']] }],
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const generatedAt = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ficha-${property.slug || property.id}-${Date.now()}.pdf`
    );
    doc.pipe(res);

    const PW = doc.page.width;
    const MX = 40;
    const FOOTER_H = 100;

    // Encabezado
    doc.rect(0, 0, PW, 88).fill(PRIMARY);
    const logoPath = getLogoPath();
    if (logoPath) {
      try {
        const whiteBuf = await getWhiteLogoBuffer(logoPath);
        if (whiteBuf) doc.image(whiteBuf, MX, 22, { height: 44 });
      } catch {
        /* ignorado */
      }
    }
    doc
      .fillColor(ACCENT)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('FICHA DE PROPIEDAD EN REMATE', PW - 240, 38, { width: 200, align: 'right' });
    doc
      .fillColor('white')
      .fontSize(8)
      .font('Helvetica')
      .text(`Generado el ${generatedAt}`, PW - 240, 54, { width: 200, align: 'right' });

    // Imagen principal
    let y = 88;
    const coverImage = property.images?.find((i) => i.isCover) || property.images?.[0];
    const coverUrl = coverImage?.url;
    const imgBuf = await getImageBuffer(coverUrl);
    const IMG_H = 210;
    if (imgBuf) {
      try {
        // doc.image con `cover` solo calcula el escalado, no recorta — hay que
        // limitar el área dibujable o la imagen se desborda sobre el contenido siguiente
        doc.save();
        doc.rect(0, y, PW, IMG_H).clip();
        doc.image(imgBuf, 0, y, {
          width: PW,
          height: IMG_H,
          cover: [PW, IMG_H],
          align: 'center',
          valign: 'center',
        });
        doc.restore();
      } catch {
        /* ignorado */
      }
    } else {
      doc.rect(0, y, PW, IMG_H).fill(BG_ALT);
      doc
        .fillColor('#9ca3af')
        .fontSize(11)
        .font('Helvetica')
        .text('Sin imagen disponible', 0, y + IMG_H / 2 - 6, { width: PW, align: 'center' });
    }
    y += IMG_H + 20;

    // Estatus + título + precio
    doc.roundedRect(MX, y, 90, 22, 11).fill(statusHex[property.status] || PRIMARY);
    doc
      .fillColor('white')
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(statusLabel[property.status] || property.status, MX, y + 6, {
        width: 90,
        align: 'center',
      });

    if (property.code) {
      doc
        .fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text(stripUnsupported(property.code), MX + 100, y + 6, {
          width: PW - MX * 2 - 100,
          align: 'right',
        });
    }

    const cleanTitle = stripUnsupported(property.title);
    doc
      .fillColor(PRIMARY)
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(cleanTitle, MX, y + 34, { width: PW - MX * 2 });

    const titleHeight = doc.heightOfString(cleanTitle, { width: PW - MX * 2, fontSize: 22 });
    y += 34 + titleHeight + 8;

    doc
      .fillColor(ACCENT)
      .fontSize(28)
      .font('Helvetica-Bold')
      .text(formatPrice(property.price), MX, y);
    y += 34;

    // Ubicación — orden fijo Estado → Ciudad → Fraccionamiento → Colonia → Calle; se
    // omiten las filas sin dato (ej. propiedades antiguas sin fraccionamiento capturado).
    const locationRows = [
      { label: 'Estado', value: stateLabel[property.city] },
      { label: 'Ciudad', value: cityLabel[property.city] || property.city },
      { label: 'Fraccionamiento', value: stripUnsupported(property.fraccionamiento) },
      { label: 'Colonia', value: stripUnsupported(property.colonia) },
      { label: 'Calle', value: stripUnsupported(property.address) },
    ].filter((row) => row.value);

    y = drawInfoBox(doc, {
      x: MX,
      y,
      width: PW - MX * 2,
      title: 'Ubicación',
      rows: locationRows,
      columns: 2,
    });

    // Características
    const featureRows = [
      { label: 'Tipo', value: typeLabel[property.type] || property.type },
      property.terrainMeters
        ? { label: 'M² terreno', value: `${property.terrainMeters} m²` }
        : null,
      property.constructionMeters
        ? { label: 'M² construcción', value: `${property.constructionMeters} m²` }
        : null,
      !property.terrainMeters && !property.constructionMeters && property.squareMeters
        ? { label: 'M²', value: `${property.squareMeters} m²` }
        : null,
      property.bedrooms ? { label: 'Recámaras', value: String(property.bedrooms) } : null,
      property.bathrooms ? { label: 'Baños', value: String(property.bathrooms) } : null,
    ].filter(Boolean);

    y = drawInfoBox(doc, {
      x: MX,
      y,
      width: PW - MX * 2,
      title: 'Características',
      rows: featureRows,
      columns: 3,
    });

    // Descripción
    if (property.description) {
      const cleanDesc = stripUnsupported(property.description);
      const descW = PW - MX * 2;
      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold').text('Descripción', MX, y);
      y += 18;

      // Set the body font before measuring — heightOfString uses the current doc font
      doc.font('Helvetica').fontSize(10.5);
      const descH = doc.heightOfString(cleanDesc, { width: descW, lineGap: 2.2 });
      if (y + descH + FOOTER_H + 12 > doc.page.height) {
        drawQuoteFooter(doc, PW, MX, FOOTER_H);
        doc.addPage({ size: 'A4', margin: 0 });
        doc.rect(0, 0, PW, 32).fill(PRIMARY);
        doc
          .fillColor('white')
          .fontSize(7.5)
          .font('Helvetica')
          .text(cleanTitle, MX, 10, { width: PW - MX * 2, align: 'center' });
        y = 48;
      }

      doc
        .fillColor(TEXT)
        .fontSize(10.5)
        .font('Helvetica')
        .text(cleanDesc, MX, y, { width: descW, align: 'justify', lineGap: 2.2 });
    }

    drawQuoteFooter(doc, PW, MX, FOOTER_H);

    doc.end();
  } catch (error) {
    console.error('Error en exportPropertyQuotePDF:', error);
    res.status(500).json({ error: 'Error al generar la cotización' });
  }
};

module.exports = {
  exportExcel,
  exportPDF,
  exportFeedbackExcel,
  exportLeadsExcel,
  exportPropertyQuotePDF,
};
