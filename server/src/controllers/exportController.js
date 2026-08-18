const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const { Property, Image, Feedback, Lead, PropertyAlert } = require('../models/index');
const {
  CITY_LABEL: cityLabel,
  PROPERTY_TYPE_LABEL: typeLabel,
  STATUS_LABEL: statusLabel,
  CITY_STATE_LABEL: stateLabel,
  LEAD_TYPE_LABEL: leadTypeLabel,
  LEGAL_PROCESS_TYPE_LABEL: legalProcessTypeLabel,
} = require('../utils/labels');
const { logAudit } = require('../utils/audit');
const { getLeadVisibilityWhere } = require('../utils/leadAccess');
const { validateEmail, validatePhone } = require('../utils/validators');
const { ApiError } = require('../middleware/errorHandler');

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
  COMPANY_ADDRESS_MAPS_URL,
} = require('../services/exportBranding');
const { formatLongDate, formatLongDateTime } = require('../utils/formatters');
const {
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
} = require('../services/exportHelpers');

// Buffer de la miniatura de portada de una propiedad, ya recortada a cuadrado y chica —
// compartido por exportExcel y exportPDF (columna "Foto" en ambos). null si la propiedad
// no tiene fotos o si la descarga falla (getImageBuffer ya atrapa sus propios errores).
const getCoverThumbnailBuffer = (property, size = 80) => {
  const cover = property.images?.find((i) => i.isCover) || property.images?.[0];
  if (!cover?.url) return Promise.resolve(null);
  return getImageBuffer(buildThumbnailUrl(cover.url, size));
};

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
    const generatedAt = formatLongDateTime();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inventario', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Orden: columnas de la hoja maestra de inventario del negocio (ver captura del pedido
    // original), usando los campos reales donde ya existían (Calle→address, Número→
    // propertyNumber, etc.), seguidas de las columnas que el export ya tenía y que no
    // están en esa hoja (Ciudad/Tipo/Estatus/Recámaras/Baños/fechas) — y sin "Visitas".
    // "Título" se mantiene junto a "#" porque, aunque no es una columna de la hoja
    // maestra, sigue siendo el identificador principal de cada fila.
    //
    // Los encabezados de las columnas que sí vienen de la hoja maestra usan el texto
    // EXACTO de esa hoja (mayúsculas, sin acentos donde la hoja tampoco los tiene) —
    // pedido explícito, no una libertad de estilo. "Precio comercial N"/"Fecha comercial
    // N" son la excepción: en la hoja original ese encabezado trae una fecha fija
    // ("PRECIO COMERCIAL 16/02/2026"), pero acá la fecha varía por propiedad (columna
    // aparte), así que un encabezado fijo con una sola fecha sería engañoso para el resto
    // de las filas.
    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Título', key: 'title', width: 30 },
      { header: 'CALLE', key: 'address', width: 26 },
      { header: 'NUMERO', key: 'propertyNumber', width: 10 },
      { header: 'LT', key: 'lot', width: 8 },
      { header: 'MZ', key: 'block', width: 8 },
      { header: 'COLONIA', key: 'colonia', width: 20 },
      { header: 'CODIGO POSTAL', key: 'postalCode', width: 12 },
      { header: 'MTS. T', key: 'terrainMeters', width: 12 },
      { header: 'MTS. C', key: 'constructionMeters', width: 16 },
      { header: 'PORTAFOLIO', key: 'portfolio', width: 11 },
      { header: 'COFINAVIT/VIABILIDAD/TIPO', key: 'legalProcessType', width: 20 },
      { header: 'PRECIO VENTA', key: 'price', width: 16 },
      { header: 'PLANTILLA', key: 'template', width: 12 },
      { header: 'CLAVE DE BUSQUEDA', key: 'code', width: 14 },
      { header: 'PLANO CATASTRAL', key: 'cadastralPlan', width: 14 },
      { header: 'OBSERVACIONES', key: 'internalNotes', width: 30 },
      { header: 'FOTO', key: 'photo', width: 8 },
      { header: 'PAGINA FB', key: 'facebookPage', width: 20 },
      { header: 'FICHA TECNICA', key: 'technicalSheet', width: 14 },
      { header: 'ZONA', key: 'zone', width: 12 },
      { header: 'TIPO DE ZONA', key: 'zoneType', width: 14 },
      { header: 'Precio comercial 1', key: 'commercialPrice1', width: 16 },
      { header: 'Fecha comercial 1', key: 'commercialPrice1Date', width: 14 },
      { header: 'Precio comercial 2', key: 'commercialPrice2', width: 16 },
      { header: 'Fecha comercial 2', key: 'commercialPrice2Date', width: 14 },
      { header: 'UTILIDAD', key: 'utility', width: 14 },
      { header: 'INGRESO A INVENTARIO', key: 'inventoryEntryDate', width: 18 },
      { header: 'Ciudad', key: 'city', width: 13 },
      { header: 'Tipo', key: 'type', width: 13 },
      { header: 'Estatus', key: 'status', width: 12 },
      { header: 'Recámaras', key: 'bedrooms', width: 11 },
      { header: 'Baños', key: 'bathrooms', width: 9 },
      { header: 'Fecha alta', key: 'createdAt', width: 13 },
      { header: 'Última modif.', key: 'updatedAt', width: 13 },
    ];
    sheet.columns = headers;
    // Posiciones (1-based) usadas por el coloreado de celdas más abajo — recalcular si se
    // vuelve a reordenar `headers`.
    const PRICE_COL = headers.findIndex((h) => h.key === 'price') + 1;
    const STATUS_COL = headers.findIndex((h) => h.key === 'status') + 1;
    const PHOTO_COL = headers.findIndex((h) => h.key === 'photo'); // 0-based, para addImage

    await buildExcelHeader({
      workbook,
      sheet,
      headers,
      title:
        '                                         TRIOMPHE BIENES RAÍCES — Inventario de Remates Bancarios',
      subtitle: `Generado el ${generatedAt}   ·   Total: ${properties.length} propiedades`,
    });

    // Miniaturas de portada — se descargan todas en paralelo antes de armar las filas
    // (una por una adentro del forEach sería secuencial y volvería lento un export con
    // muchas propiedades). DATA_START_ROW es la fila 0-based donde empieza la primera
    // fila de datos (después de título/subtítulo/encabezado).
    const DATA_START_ROW = 3;
    const coverBuffers = await Promise.all(properties.map((p) => getCoverThumbnailBuffer(p)));

    // Datos
    properties.forEach((p, i) => {
      const isAlt = i % 2 === 0;
      const row = sheet.addRow({
        num: i + 1,
        title: dash(p.title),
        address: dash(p.address),
        propertyNumber: dash(p.propertyNumber),
        lot: dash(p.lot),
        block: dash(p.block),
        colonia: dash(p.colonia),
        postalCode: dash(p.postalCode),
        terrainMeters: p.terrainMeters ? `${p.terrainMeters} m²` : '—',
        constructionMeters: p.constructionMeters ? `${p.constructionMeters} m²` : '—',
        portfolio: dash(p.portfolio),
        legalProcessType: legalProcessTypeLabel[p.legalProcessType] || dash(p.legalProcessType),
        price: formatPrice(p.price),
        template: dash(p.template),
        code: dash(p.code),
        cadastralPlan: dash(p.cadastralPlan),
        internalNotes: dash(p.internalNotes),
        // La imagen (si existe) se dibuja aparte, encima de esta celda — texto vacío para
        // no competir visualmente con ella; "—" solo cuando de verdad no hay foto.
        photo: coverBuffers[i] ? '' : dash(null),
        facebookPage: dash(p.facebookPage),
        technicalSheet: dash(p.technicalSheet),
        zone: dash(p.zone),
        zoneType: dash(p.zoneType),
        commercialPrice1: p.commercialPrice1 != null ? formatPrice(p.commercialPrice1) : '—',
        commercialPrice1Date: formatDate(p.commercialPrice1Date),
        commercialPrice2: p.commercialPrice2 != null ? formatPrice(p.commercialPrice2) : '—',
        commercialPrice2Date: formatDate(p.commercialPrice2Date),
        utility: p.utility != null ? formatPrice(p.utility) : '—',
        inventoryEntryDate: formatDate(p.inventoryEntryDate),
        city: cityLabel[p.city] || p.city,
        type: typeLabel[p.type] || p.type,
        status: statusLabel[p.status] || p.status,
        bedrooms: dash(p.bedrooms),
        bathrooms: dash(p.bathrooms),
        createdAt: formatDate(p.createdAt),
        updatedAt: formatDate(p.updatedAt),
      });

      // 30 en vez de 18: dejar la miniatura de portada (chica, pero necesita algo de alto
      // real para verse como una foto y no como un punto) sin desproporcionar el resto de
      // la fila — se aplica parejo a todas las filas para que la hoja se vea uniforme.
      row.height = 30;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });

      if (coverBuffers[i]) {
        const imgId = workbook.addImage({ buffer: coverBuffers[i], extension: 'jpeg' });
        // tl/br (en vez de tl+ext en píxeles) ancla la imagen a los bordes exactos de la
        // celda — se ajusta sola al ancho/alto real de la columna/fila sin desbordarse,
        // sin tener que convertir el ancho de columna de ExcelJS a píxeles a mano.
        sheet.addImage(imgId, {
          tl: { col: PHOTO_COL, row: DATA_START_ROW + i },
          br: { col: PHOTO_COL + 1, row: DATA_START_ROW + i + 1 },
        });
      }

      row.getCell(STATUS_COL).font = {
        bold: true,
        size: 9,
        color: { argb: statusArgb[p.status] || TEXT_ARGB },
      };
      row.getCell(PRICE_COL).font = { bold: true, size: 9, color: { argb: PRIMARY_ARGB } };
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
    handleExportError(req, res, error, 'Error al generar Excel');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────
// Mismo set de campos que el Excel (ver exportExcel), salvo los que el negocio pidió
// excluir del PDF explícitamente: Calle, Número, LT, MZ, Observaciones, Página FB, Ficha
// técnica, Zona, Tipo de zona, Precio/Fecha comercial ×2, Utilidad, Ingreso a inventario —
// con esos fuera, las 19 columnas restantes sí caben en una página A4 horizontal legible
// (762pt de ancho útil = page.width 842pt − 40pt de margen a cada lado). `key` liga cada
// columna a su campo real; `COL_IDX` (más abajo) resuelve la posición por key en vez de un
// índice fijo, para no repetir el bug de columnas que cambiaban de significado al reordenar
// (ver exportExcel/PRICE_COL/STATUS_COL).
const PDF_COLS = [
  { key: 'title', label: 'Título', width: 78 },
  { key: 'colonia', label: 'Colonia', width: 44 },
  { key: 'postalCode', label: 'C.P.', width: 30 },
  { key: 'terrainMeters', label: 'M² Terr.', width: 36 },
  { key: 'constructionMeters', label: 'M² Constr.', width: 38 },
  { key: 'portfolio', label: 'Portafolio', width: 36 },
  { key: 'legalProcessType', label: 'Proceso legal', width: 46 },
  { key: 'price', label: 'Precio venta', width: 58 },
  { key: 'template', label: 'Plantilla', width: 34 },
  { key: 'code', label: 'Clave búsq.', width: 42 },
  { key: 'cadastralPlan', label: 'Plano catastral', width: 46 },
  { key: 'photo', label: 'Foto', width: 34 },
  { key: 'city', label: 'Ciudad', width: 42 },
  { key: 'type', label: 'Tipo', width: 36 },
  { key: 'status', label: 'Estatus', width: 42 },
  { key: 'bedrooms', label: 'Recám.', width: 26 },
  { key: 'bathrooms', label: 'Baños', width: 22 },
  { key: 'createdAt', label: 'Alta', width: 36 },
  { key: 'updatedAt', label: 'Modif.', width: 36 },
];
const COL_IDX = Object.fromEntries(PDF_COLS.map((c, i) => [c.key, i]));

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
    const generatedAt = formatLongDateTime();

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

    // Miniaturas de portada en paralelo — misma razón que en exportExcel: pedirlas una por
    // una adentro del for de abajo sería secuencial y volvería lento un inventario grande.
    const coverBuffers = await Promise.all(properties.map((p) => getCoverThumbnailBuffer(p)));

    const ROW_H = 26; // antes 22 — la miniatura de portada necesita algo más de alto para leerse

    for (let i = 0; i < properties.length; i++) {
      const p = properties.at(i);

      if (y + ROW_H > doc.page.height - 40) {
        drawPDFFooter(doc);
        doc.addPage({ layout: 'landscape' });
        await drawPDFHeader(doc, properties, generatedAt, logoPath);
        y = drawPDFTableHeader(doc, 80);
      }

      doc.rect(40, y, doc.page.width - 80, ROW_H).fill(i % 2 === 0 ? BG_ALT : '#ffffff');

      // Foto de portada — ya viene recortada a cuadrado desde Cloudinary (buildThumbnailUrl),
      // así que solo hace falta centrarla dentro de su columna, sin distorsión ni desborde.
      const photoBuf = coverBuffers[i];
      if (photoBuf) {
        try {
          const colDef = PDF_COLS[COL_IDX.photo];
          const thumbSize = ROW_H - 4;
          const thumbX = xPositions[COL_IDX.photo] + (colDef.width - thumbSize) / 2;
          doc.image(photoBuf, thumbX, y + 2, { width: thumbSize, height: thumbSize });
        } catch {
          /* ignorado */
        }
      }

      const rowData = [
        { val: dash(p.title), col: COL_IDX.title },
        { val: dash(p.colonia), col: COL_IDX.colonia },
        { val: dash(p.postalCode), col: COL_IDX.postalCode },
        {
          val: p.terrainMeters ? `${p.terrainMeters} m²` : '—',
          col: COL_IDX.terrainMeters,
        },
        {
          val: p.constructionMeters ? `${p.constructionMeters} m²` : '—',
          col: COL_IDX.constructionMeters,
        },
        { val: dash(p.portfolio), col: COL_IDX.portfolio },
        {
          val: legalProcessTypeLabel[p.legalProcessType] || dash(p.legalProcessType),
          col: COL_IDX.legalProcessType,
        },
        { val: formatPrice(p.price), col: COL_IDX.price, bold: true, color: PRIMARY },
        { val: dash(p.template), col: COL_IDX.template },
        { val: dash(p.code), col: COL_IDX.code },
        { val: dash(p.cadastralPlan), col: COL_IDX.cadastralPlan },
        // Sin entrada para "photo": esa columna se llena dibujando la miniatura arriba,
        // no como texto (si no hay foto, la celda simplemente queda vacía).
        { val: cityLabel[p.city] || p.city, col: COL_IDX.city },
        { val: typeLabel[p.type] || p.type, col: COL_IDX.type },
        { val: statusLabel[p.status] || p.status, col: COL_IDX.status, isStatus: true },
        { val: dash(p.bedrooms), col: COL_IDX.bedrooms },
        { val: dash(p.bathrooms), col: COL_IDX.bathrooms },
        { val: formatDate(p.createdAt), col: COL_IDX.createdAt },
        { val: formatDate(p.updatedAt), col: COL_IDX.updatedAt },
      ];

      rowData.forEach(({ val, col, isStatus, bold, color }) => {
        const colDef = PDF_COLS.at(col);
        const xPos = xPositions.at(col) + 3;
        const wid = colDef.width - 6;
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
    handleExportError(req, res, error, 'Error al generar PDF');
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

    const generatedAt = formatLongDateTime();

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
    handleExportError(req, res, error, 'Error al generar Excel del buzón');
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
    // CRM de Leads: cierra la fuga de "exportar todos los leads a Excel" — mismo
    // filtrado por fila que getLeads.
    Object.assign(where, getLeadVisibilityWhere(req.user) || {});

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

    const generatedAt = formatLongDateTime();

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
    handleExportError(req, res, error, 'Error al generar Excel de leads');
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
    .text(COMPANY_ADDRESS, MX + colW, top + 30, {
      width: colW,
      lineGap: 1,
      link: COMPANY_ADDRESS_MAPS_URL,
      underline: true,
    })
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
    if (!property) throw new ApiError(404, 'Propiedad no encontrada');

    const generatedAt = formatLongDate(new Date());

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

    // Ubicación — orden fijo Estado → Ciudad → Fraccionamiento/Colonia → Calle; se omiten
    // las filas sin dato (ej. propiedades antiguas sin colonia capturada).
    const locationRows = [
      { label: 'Estado', value: stateLabel[property.city] },
      { label: 'Ciudad', value: cityLabel[property.city] || property.city },
      { label: 'Fraccionamiento/Colonia', value: stripUnsupported(property.colonia) },
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
      property.bathrooms ? { label: 'Baños completos', value: String(property.bathrooms) } : null,
      property.halfBathrooms
        ? { label: 'Medios baños', value: String(property.halfBathrooms) }
        : null,
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
    handleExportError(req, res, error, 'Error al generar la cotización');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL/PDF — Lista de espera
// ─────────────────────────────────────────────────────────────────────────────
const businessLineLabel = { remate: 'Remate Bancario', infonavit: 'Infonavit', inversion: 'Inversión' };

// Mismo criterio de filtros que waitingListController.getWaitingList (city/state/amount/
// name/phone/businessLine) — se reimplementa acá en vez de importarse porque ese controller
// además pagina, y estos exports siempre quieren la lista completa que matchea los filtros.
const getFilteredWaitingList = async (query) => {
  const { city, state, amount, name, phone, businessLine } = query;
  const where = { source: 'staff' };

  if (city) where.city = city;
  if (businessLine) where.businessLine = businessLine;
  if (state) where.state = { [Op.like]: `%${state}%` };
  if (name) where.name = { [Op.like]: `%${name}%` };
  if (phone) where.phone = { [Op.like]: `%${phone}%` };
  if (amount !== undefined && amount !== '') {
    const parsed = Number(amount);
    if (Number.isFinite(parsed)) {
      where[Op.and] = [
        { [Op.or]: [{ minPrice: null }, { minPrice: { [Op.lte]: parsed } }] },
        { [Op.or]: [{ maxPrice: null }, { maxPrice: { [Op.gte]: parsed } }] },
      ];
    }
  }

  return PropertyAlert.findAll({ where, order: [['createdAt', 'DESC']] });
};

const priceRangeLabel = (entry) => {
  if (entry.minPrice && entry.maxPrice)
    return `${formatPrice(entry.minPrice)} – ${formatPrice(entry.maxPrice)}`;
  if (entry.maxPrice) return `Hasta ${formatPrice(entry.maxPrice)}`;
  if (entry.minPrice) return `Desde ${formatPrice(entry.minPrice)}`;
  return '—';
};

const exportWaitingListExcel = async (req, res) => {
  try {
    const entries = await getFilteredWaitingList(req.query);
    logAudit(req, 'export', 'alert', null, {
      format: 'excel',
      count: entries.length,
      query: req.query,
    });
    const generatedAt = formatLongDateTime();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Lista de espera', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Nombre', key: 'name', width: 24 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Ciudad', key: 'city', width: 16 },
      { header: 'Estado', key: 'state', width: 16 },
      { header: 'Línea de negocio', key: 'businessLine', width: 18 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Monto', key: 'amount', width: 24 },
      { header: 'Fecha', key: 'createdAt', width: 14 },
    ];
    sheet.columns = headers;

    await buildExcelHeader({
      workbook,
      sheet,
      headers,
      title: '                                         TRIOMPHE BIENES RAÍCES — Lista de espera',
      subtitle: `Generado el ${generatedAt}   ·   Total: ${entries.length} clientes`,
    });

    entries.forEach((entry, i) => {
      const isAlt = i % 2 === 0;
      const row = sheet.addRow({
        num: i + 1,
        name: dash(entry.name),
        phone: dash(entry.phone),
        city: cityLabel[entry.city] || dash(entry.city),
        state: dash(entry.state),
        businessLine: businessLineLabel[entry.businessLine] || 'Sin especificar',
        type: typeLabel[entry.type] || dash(entry.type),
        amount: priceRangeLabel(entry),
        createdAt: formatDate(entry.createdAt),
      });
      row.height = 18;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });
    });

    const totalRow = sheet.addRow({ num: '', name: `TOTAL: ${entries.length} clientes` });
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
      `attachment; filename=triomphe-lista-espera-${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    handleExportError(req, res, error, 'Error al generar Excel de la lista de espera');
  }
};

const WAITING_LIST_PDF_COLS = [
  { label: 'Nombre', width: 140, key: 'name' },
  { label: 'Teléfono', width: 90, key: 'phone' },
  { label: 'Ciudad', width: 80, key: 'city' },
  { label: 'Estado', width: 90, key: 'state' },
  { label: 'Línea de negocio', width: 100, key: 'businessLine' },
  { label: 'Monto', width: 140, key: 'amount' },
  { label: 'Fecha', width: 70, key: 'createdAt' },
];

const drawWaitingListPDFHeader = async (doc, entries, generatedAt, logoPath) => {
  doc.rect(0, 0, doc.page.width, 72).fill(PRIMARY);
  if (logoPath) {
    try {
      const whiteBuf = await getWhiteLogoBuffer(logoPath);
      if (whiteBuf) doc.image(whiteBuf, 40, 12, { height: 48 });
    } catch {
      /* ignorado */
    }
  }
  doc.fillColor('white').fontSize(15).font('Helvetica-Bold').text('TRIOMPHE BIENES RAÍCES', 168, 16);
  doc.fontSize(9).font('Helvetica').text('Lista de espera de clientes', 168, 35);
  doc.fontSize(7.5).text(`Generado: ${generatedAt}`, 168, 51);

  doc.roundedRect(doc.page.width - 152, 20, 112, 32, 5).fill(ACCENT);
  doc
    .fillColor(PRIMARY)
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(`${entries.length} clientes`, doc.page.width - 148, 30, { width: 104, align: 'center' });
};

const drawWaitingListPDFTableHeader = (doc, y) => {
  const pw = doc.page.width - 80;
  doc.rect(40, y, pw, 20).fill(PRIMARY);
  let x = 40;
  WAITING_LIST_PDF_COLS.forEach((col) => {
    doc
      .fillColor('white')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(col.label, x + 3, y + 6, { width: col.width - 6, ellipsis: true, lineBreak: false });
    x += col.width;
  });
  return y + 20;
};

const exportWaitingListPDF = async (req, res) => {
  try {
    const entries = await getFilteredWaitingList(req.query);
    logAudit(req, 'export', 'alert', null, {
      format: 'pdf',
      count: entries.length,
      query: req.query,
    });
    const generatedAt = formatLongDateTime();

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=triomphe-lista-espera-${Date.now()}.pdf`
    );
    doc.pipe(res);

    const logoPath = getLogoPath();
    await drawWaitingListPDFHeader(doc, entries, generatedAt, logoPath);
    let y = drawWaitingListPDFTableHeader(doc, 80);

    const xPositions = [];
    let acc = 40;
    WAITING_LIST_PDF_COLS.forEach((c) => {
      xPositions.push(acc);
      acc += c.width;
    });

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const ROW_H = 20;
      if (y + ROW_H > doc.page.height - 40) {
        drawPDFFooter(doc);
        doc.addPage({ layout: 'landscape' });
        await drawWaitingListPDFHeader(doc, entries, generatedAt, logoPath);
        y = drawWaitingListPDFTableHeader(doc, 80);
      }

      doc.rect(40, y, doc.page.width - 80, ROW_H).fill(i % 2 === 0 ? BG_ALT : '#ffffff');

      const rowValues = [
        dash(entry.name),
        dash(entry.phone),
        cityLabel[entry.city] || dash(entry.city),
        dash(entry.state),
        businessLineLabel[entry.businessLine] || 'Sin especificar',
        priceRangeLabel(entry),
        formatDate(entry.createdAt),
      ];
      rowValues.forEach((val, i) => {
        const colDef = WAITING_LIST_PDF_COLS[i];
        doc
          .fillColor(TEXT)
          .fontSize(7)
          .font('Helvetica')
          .text(stripUnsupported(String(val)), xPositions[i] + 3, y + 6, {
            width: colDef.width - 6,
            ellipsis: true,
            lineBreak: false,
          });
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
    handleExportError(req, res, error, 'Error al generar PDF de la lista de espera');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL/PDF — Catálogo público (sitio principal, sin auth, gateado por datos de contacto)
// ─────────────────────────────────────────────────────────────────────────────
const CATALOG_PDF_COLS = [
  { label: 'Título', width: 180, key: 'title' },
  { label: 'Ciudad', width: 90, key: 'city' },
  { label: 'Tipo', width: 80, key: 'type' },
  { label: 'Categoría', width: 90, key: 'category' },
  { label: 'Precio', width: 100, key: 'price' },
  { label: 'M² Terreno', width: 70, key: 'terrainMeters' },
  { label: 'M² Constr.', width: 70, key: 'constructionMeters' },
  { label: 'Recámaras', width: 65, key: 'bedrooms' },
  { label: 'Baños', width: 65, key: 'bathrooms' },
];

// Solo inventario público (`status: 'disponible'`, sin `internalNotes` ni columnas de uso
// interno como visitas/fechas de alta) — a diferencia de `getFilteredProperties`
// (exportHelpers.js), que un visitante público nunca debe poder invocar directamente.
const getPublicCatalogProperties = async (query) => {
  const { city, type, category, businessLine } = query;
  const where = { status: 'disponible' };
  if (city) where.city = city;
  if (type) where.type = type;
  if (category) where.category = category;
  if (businessLine) where.businessLine = businessLine;

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
      'category',
      'price',
      'terrainMeters',
      'constructionMeters',
      'bedrooms',
      'bathrooms',
      'halfBathrooms',
    ],
  });
};

const categoryLabelPublic = { remate: 'Remates', renta: 'Renta', compra_venta: 'Compra-Venta' };

// Crea el Lead que registra quién descargó el catálogo — mismas reglas de validación que
// el formulario público "Contactar asesor" (leadController.createLead): nombre y teléfono
// requeridos, email opcional.
const createCatalogDownloadLead = async ({ name, phone, email }, format) => {
  if (!name || !name.trim()) throw new ApiError(400, 'Nombre es requerido');
  if (!phone || !validatePhone(phone))
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');
  if (email && !validateEmail(email)) throw new ApiError(400, 'Email inválido');

  await Lead.create({
    name: name.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : null,
    type: 'contacto',
    source: 'directo',
    message: `Descargó el catálogo de propiedades (${format === 'excel' ? 'Excel' : 'PDF'})`,
  });
};

// POST /api/export/catalog/excel — público, sin auth
const exportCatalogExcel = async (req, res) => {
  try {
    await createCatalogDownloadLead(req.body, 'excel');
    const properties = await getPublicCatalogProperties(req.body);
    const generatedAt = formatLongDateTime();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Catálogo', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Título', key: 'title', width: 34 },
      { header: 'Ciudad', key: 'city', width: 13 },
      { header: 'Tipo', key: 'type', width: 13 },
      { header: 'Categoría', key: 'category', width: 15 },
      { header: 'Precio', key: 'price', width: 17 },
      { header: 'M² Terreno', key: 'terrainMeters', width: 12 },
      { header: 'M² Construcción', key: 'constructionMeters', width: 16 },
      { header: 'Recámaras', key: 'bedrooms', width: 11 },
      { header: 'Baños', key: 'bathrooms', width: 9 },
    ];
    sheet.columns = headers;

    await buildExcelHeader({
      workbook,
      sheet,
      headers,
      title: '                                         TRIOMPHE BIENES RAÍCES — Catálogo de Propiedades',
      subtitle: `Generado el ${generatedAt}   ·   Total: ${properties.length} propiedades`,
    });

    properties.forEach((p, i) => {
      const isAlt = i % 2 === 0;
      const bathsLabel = p.halfBathrooms
        ? `${dash(p.bathrooms)} + ${p.halfBathrooms} medio`
        : dash(p.bathrooms);
      const row = sheet.addRow({
        num: i + 1,
        title: dash(p.title),
        city: cityLabel[p.city] || p.city,
        type: typeLabel[p.type] || p.type,
        category: categoryLabelPublic[p.category] || p.category,
        price: formatPrice(p.price),
        terrainMeters: p.terrainMeters ? `${p.terrainMeters} m²` : '—',
        constructionMeters: p.constructionMeters ? `${p.constructionMeters} m²` : '—',
        bedrooms: dash(p.bedrooms),
        bathrooms: bathsLabel,
      });
      row.height = 18;
      row.eachCell((cell) => {
        cell.font = { size: 9, color: { argb: TEXT_ARGB } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
        if (isAlt) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BG_ALT_ARGB } };
      });
    });

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
      `attachment; filename=triomphe-catalogo-${Date.now()}.xlsx`
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    handleExportError(req, res, error, 'Error al generar el catálogo en Excel');
  }
};

const drawCatalogPDFHeader = async (doc, properties, generatedAt, logoPath) => {
  doc.rect(0, 0, doc.page.width, 72).fill(PRIMARY);
  if (logoPath) {
    try {
      const whiteBuf = await getWhiteLogoBuffer(logoPath);
      if (whiteBuf) doc.image(whiteBuf, 40, 12, { height: 48 });
    } catch {
      /* ignorado */
    }
  }
  doc.fillColor('white').fontSize(15).font('Helvetica-Bold').text('TRIOMPHE BIENES RAÍCES', 168, 16);
  doc.fontSize(9).font('Helvetica').text('Catálogo de Propiedades', 168, 35);
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

const drawCatalogPDFTableHeader = (doc, y) => {
  const pw = doc.page.width - 80;
  doc.rect(40, y, pw, 20).fill(PRIMARY);
  let x = 40;
  CATALOG_PDF_COLS.forEach((col) => {
    doc
      .fillColor('white')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(col.label, x + 3, y + 6, { width: col.width - 6, ellipsis: true, lineBreak: false });
    x += col.width;
  });
  return y + 20;
};

// POST /api/export/catalog/pdf — público, sin auth
const exportCatalogPDF = async (req, res) => {
  try {
    await createCatalogDownloadLead(req.body, 'pdf');
    const properties = await getPublicCatalogProperties(req.body);
    const generatedAt = formatLongDateTime();

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-catalogo-${Date.now()}.pdf`);
    doc.pipe(res);

    const logoPath = getLogoPath();
    await drawCatalogPDFHeader(doc, properties, generatedAt, logoPath);
    let y = drawCatalogPDFTableHeader(doc, 80);

    const xPositions = [];
    let acc = 40;
    CATALOG_PDF_COLS.forEach((c) => {
      xPositions.push(acc);
      acc += c.width;
    });

    for (let i = 0; i < properties.length; i++) {
      const p = properties[i];
      const ROW_H = 20;
      if (y + ROW_H > doc.page.height - 40) {
        drawPDFFooter(doc);
        doc.addPage({ layout: 'landscape' });
        await drawCatalogPDFHeader(doc, properties, generatedAt, logoPath);
        y = drawCatalogPDFTableHeader(doc, 80);
      }

      doc.rect(40, y, doc.page.width - 80, ROW_H).fill(i % 2 === 0 ? BG_ALT : '#ffffff');

      const bathsLabel = p.halfBathrooms
        ? `${dash(p.bathrooms)} + ${p.halfBathrooms} medio`
        : dash(p.bathrooms);
      const rowValues = [
        dash(p.title),
        cityLabel[p.city] || p.city,
        typeLabel[p.type] || p.type,
        categoryLabelPublic[p.category] || p.category,
        formatPrice(p.price),
        p.terrainMeters ? `${p.terrainMeters} m²` : '—',
        p.constructionMeters ? `${p.constructionMeters} m²` : '—',
        dash(p.bedrooms),
        bathsLabel,
      ];
      rowValues.forEach((val, colIdx) => {
        const colDef = CATALOG_PDF_COLS[colIdx];
        doc
          .fillColor(TEXT)
          .fontSize(7)
          .font('Helvetica')
          .text(stripUnsupported(String(val)), xPositions[colIdx] + 3, y + 6, {
            width: colDef.width - 6,
            ellipsis: true,
            lineBreak: false,
          });
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
    handleExportError(req, res, error, 'Error al generar el catálogo en PDF');
  }
};

module.exports = {
  exportExcel,
  exportPDF,
  exportFeedbackExcel,
  exportLeadsExcel,
  exportPropertyQuotePDF,
  exportWaitingListExcel,
  exportWaitingListPDF,
  exportCatalogExcel,
  exportCatalogPDF,
};
