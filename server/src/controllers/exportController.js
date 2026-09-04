const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Op } = require('sequelize');
const { Property, Feedback, Lead, PropertyAlert } = require('../models/index');
const {
  CITY_LABEL: cityLabel,
  PROPERTY_TYPE_LABEL: typeLabel,
  LEAD_TYPE_LABEL: leadTypeLabel,
  BUSINESS_LINE_LABEL: businessLineLabel,
  LEAD_URGENCY_LABEL: leadUrgencyLabel,
} = require('../utils/labels');
const { logAudit } = require('../utils/audit');
const { getLeadVisibilityWhere } = require('../utils/leadAccess');
const { validateEmail, validatePhone } = require('../utils/validators');
const { ApiError } = require('../middleware/errorHandler');
const { isInventoryDownloadEnabled } = require('../services/settingsService');
const { logActivity } = require('../utils/pipelineHelpers');

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
} = require('../services/exportBranding');
const { formatLongDateTime } = require('../utils/formatters');
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

    // Orden exacto pedido por el negocio (35 columnas de la hoja maestra de inventario,
    // este orden específico) — reemplaza el orden anterior en bloques (columnas del Excel
    // original + "extras" al final); ya no incluye Título ni Estatus, que no están en este
    // pedido. `legalProcessType` tampoco aparece aquí — sigue existiendo en el modelo pero
    // esta hoja usa su desglose real (Cofinavit/Viabilidad/Tipo, ver Property.js).
    const headers = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Estado', key: 'state', width: 14 },
      { header: 'Ciudad', key: 'city', width: 13 },
      { header: 'Foto', key: 'photo', width: 8 },
      { header: 'Tipo de inmueble', key: 'type', width: 16 },
      { header: 'Calle', key: 'address', width: 26 },
      { header: 'Número', key: 'propertyNumber', width: 10 },
      { header: 'LT', key: 'lot', width: 8 },
      { header: 'MZ', key: 'block', width: 8 },
      { header: 'Colonia', key: 'colonia', width: 20 },
      { header: 'Código Postal', key: 'postalCode', width: 12 },
      { header: 'M²T', key: 'terrainMeters', width: 12 },
      { header: 'M²C', key: 'constructionMeters', width: 16 },
      { header: 'Portafolio', key: 'portfolio', width: 11 },
      { header: 'Cofinavit', key: 'cofinavit', width: 14 },
      { header: 'Viabilidad', key: 'viabilidad', width: 18 },
      { header: 'Tipo', key: 'tipo', width: 16 },
      { header: 'Precio', key: 'price', width: 16 },
      { header: 'Plantilla', key: 'template', width: 16 },
      { header: 'Clave', key: 'code', width: 14 },
      { header: 'Plano Catastral', key: 'cadastralPlan', width: 16 },
      { header: 'Observaciones', key: 'internalNotes', width: 30 },
      { header: 'Tipo de Foto', key: 'photoType', width: 14 },
      { header: 'Ficha Técnica', key: 'technicalSheet', width: 16 },
      { header: 'Zona', key: 'zone', width: 12 },
      { header: 'Tipo de zona', key: 'zoneType', width: 14 },
      { header: 'Precio comercial', key: 'commercialPrice1', width: 16 },
      { header: 'Utilidad', key: 'utility', width: 14 },
      { header: 'Adeudo Agua', key: 'waterDebt', width: 14 },
      { header: 'Adeudo Luz', key: 'electricityDebt', width: 14 },
      { header: 'Adeudo Predial', key: 'propertyTaxDebt', width: 14 },
      { header: 'Adeudos Actualizado', key: 'debtsUpdateDate', width: 16 },
      { header: 'Recámaras', key: 'bedrooms', width: 11 },
      { header: 'Baños', key: 'bathrooms', width: 9 },
      { header: 'Fecha Alta', key: 'createdAt', width: 13 },
      { header: 'Última Modificación', key: 'updatedAt', width: 15 },
    ];
    sheet.columns = headers;
    // Posiciones (1-based) usadas por el coloreado de celdas más abajo — recalcular si se
    // vuelve a reordenar `headers`.
    const PRICE_COL = headers.findIndex((h) => h.key === 'price') + 1;
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
        state: dash(p.state),
        city: cityLabel[p.city] || p.city,
        // La imagen (si existe) se dibuja aparte, encima de esta celda — texto vacío para
        // no competir visualmente con ella; "—" solo cuando de verdad no hay foto.
        photo: coverBuffers[i] ? '' : dash(null),
        type: typeLabel[p.type] || p.type,
        address: dash(p.address),
        propertyNumber: dash(p.propertyNumber),
        lot: dash(p.lot),
        block: dash(p.block),
        colonia: dash(p.colonia),
        postalCode: dash(p.postalCode),
        terrainMeters: p.terrainMeters ? `${p.terrainMeters} m²` : '—',
        constructionMeters: p.constructionMeters ? `${p.constructionMeters} m²` : '—',
        portfolio: dash(p.portfolio),
        cofinavit: p.cofinavit != null ? formatPrice(p.cofinavit) : '—',
        viabilidad: dash(p.viabilidad),
        tipo: dash(p.tipo),
        price: formatPrice(p.price),
        template: dash(p.template),
        code: dash(p.code),
        cadastralPlan: dash(p.cadastralPlan),
        internalNotes: dash(p.internalNotes),
        photoType: dash(p.photoType),
        technicalSheet: dash(p.technicalSheet),
        zone: dash(p.zone),
        zoneType: dash(p.zoneType),
        commercialPrice1: p.commercialPrice1 != null ? formatPrice(p.commercialPrice1) : '—',
        utility: p.utility != null ? formatPrice(p.utility) : '—',
        waterDebt: dash(p.waterDebt),
        electricityDebt: dash(p.electricityDebt),
        propertyTaxDebt: dash(p.propertyTaxDebt),
        debtsUpdateDate: formatDate(p.debtsUpdateDate),
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

      row.getCell(PRICE_COL).font = { bold: true, size: 9, color: { argb: PRIMARY_ARGB } };
    });

    // Fila total — en la 2ª columna ("Estado", ver headers) porque ya no hay columna
    // "Título" a la que anclarlo.
    const totalRow = sheet.addRow({ num: '', state: `TOTAL: ${properties.length} propiedades` });
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
// Set de columnas del PDF de inventario pedido explícitamente por el negocio, en este orden
// exacto — 20 columnas ajustadas para caber en una página A4 horizontal (762pt de ancho útil
// = page.width 842pt − 40pt de margen a cada lado). Hay 2 columnas con key distinto pero
// label "Tipo": `type` (tipo de inmueble: casa/departamento/...) y `tipo` (proceso legal,
// texto libre — ver Property.tipo/cofinavit/viabilidad, desglose de lo que antes era una
// sola columna combinada "COFINAVIT/VIABILIDAD/TIPO", ver legalProcessType). `key` liga cada
// columna a su campo real; `COL_IDX` (más abajo) resuelve la posición por key en vez de un
// índice fijo, para no repetir el bug de columnas que cambiaban de significado al reordenar
// (ver exportExcel/PRICE_COL/STATUS_COL).
const PDF_COLS = [
  { key: 'state', label: 'Estado', width: 32 },
  { key: 'city', label: 'Ciudad', width: 32 },
  { key: 'photo', label: 'Foto', width: 30 },
  { key: 'type', label: 'Tipo', width: 40 },
  { key: 'address', label: 'Calle', width: 50 },
  { key: 'propertyNumber', label: 'Número', width: 33 },
  { key: 'lot', label: 'LT', width: 20 },
  { key: 'block', label: 'MZ', width: 20 },
  { key: 'colonia', label: 'Colonia', width: 34 },
  { key: 'postalCode', label: 'Código Postal', width: 56 },
  { key: 'terrainMeters', label: 'M²T', width: 34 },
  { key: 'constructionMeters', label: 'M²C', width: 34 },
  { key: 'portfolio', label: 'Portafolio', width: 40 },
  { key: 'cofinavit', label: 'Confinavit', width: 44 },
  { key: 'viabilidad', label: 'Viabilidad', width: 44 },
  { key: 'tipo', label: 'Tipo', width: 34 },
  { key: 'price', label: 'Precio', width: 50 },
  { key: 'template', label: 'Plantilla', width: 33 },
  { key: 'code', label: 'Clave', width: 44 },
  { key: 'cadastralPlan', label: 'Plano Catastral', width: 58 },
];
const COL_IDX = Object.fromEntries(PDF_COLS.map((c, i) => [c.key, i]));

// pdfkit: `lineBreak: false` NO evita el wrap a una 2ª línea cuando también se pasa
// `width` (solo afecta si se calcula un width default), y `ellipsis: true` solo trunca si
// además se pasa `height` (ver LineWrapper.wrap en pdfkit). Sin `height`, una celda con
// texto más ancho que su columna (ej. una colonia larga) se envuelve a una 2ª línea real;
// si eso empuja doc.y más allá del margen inferior, pdfkit inserta un salto de página
// automático A MITAD DE LA FILA (LineWrapper.nextSection → continueOnNewPage), saltándose
// el control manual de paginación del loop de abajo — así es como una fila terminaba
// partida entre dos páginas. Pasar `height` de una línea activa el truncado con "…" y hace
// que nextSection() retorne sin agregar página (pdfkit: `if (this.height != null) return
// false`), forzando una sola línea real por celda. Esto sigue aplicando a encabezados de
// tabla y pie de página (una sola línea, ancho fijo conocido de antemano). Las FILAS de
// datos del inventario (ver exportPDF más abajo) usan la estrategia inversa a propósito:
// sin `height`/`ellipsis`, dejando que el texto se envuelva, y calculando el alto real de
// cada fila ANTES de dibujarla (con `doc.heightOfString`) para que la fila completa —
// título largo incluido — quepa siempre dentro del margen inferior sin disparar ese salto
// de página automático ni cortar texto (pedido: "quiero que se vea todo el texto").
const PDF_CELL_TEXT_HEIGHT = 10;

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
      .text(col.label, x + 3, y + 6, {
        width: col.width - 6,
        height: PDF_CELL_TEXT_HEIGHT,
        ellipsis: true,
        lineBreak: false,
      });
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
      // `y` (page.height - 18) cae dentro del margen inferior del documento (margin: 40),
      // fuera del maxY implícito de pdfkit (page.height - margins.bottom) — sin `height`,
      // pdfkit interpreta que ya no hay espacio y agrega una página nueva casi en blanco
      // solo para este texto (mismo mecanismo que partía las filas, ver PDF_CELL_TEXT_HEIGHT
      // arriba). `height` evita ese salto de página fantasma.
      { width: doc.page.width - 80, height: 14, align: 'center' }
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

    const MIN_ROW_H = 26; // antes ROW_H fijo — ahora es el piso: alcanza para la miniatura de
    // portada aunque el texto de la fila quepa en una sola línea.
    const ROW_V_PADDING = 14; // espacio vertical libre arriba+abajo del texto dentro de la celda

    for (let i = 0; i < properties.length; i++) {
      const p = properties.at(i);

      const rowData = [
        // Sin entrada para "photo": esa columna se llena dibujando la miniatura arriba,
        // no como texto (si no hay foto, la celda simplemente queda vacía).
        { val: dash(p.state), col: COL_IDX.state },
        { val: cityLabel[p.city] || p.city, col: COL_IDX.city },
        { val: typeLabel[p.type] || p.type, col: COL_IDX.type },
        { val: dash(p.address), col: COL_IDX.address },
        { val: dash(p.propertyNumber), col: COL_IDX.propertyNumber },
        { val: dash(p.lot), col: COL_IDX.lot },
        { val: dash(p.block), col: COL_IDX.block },
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
        { val: p.cofinavit != null ? formatPrice(p.cofinavit) : '—', col: COL_IDX.cofinavit },
        { val: dash(p.viabilidad), col: COL_IDX.viabilidad },
        { val: dash(p.tipo), col: COL_IDX.tipo },
        { val: formatPrice(p.price), col: COL_IDX.price, bold: true, color: PRIMARY },
        { val: dash(p.template), col: COL_IDX.template },
        { val: dash(p.code), col: COL_IDX.code },
        { val: dash(p.cadastralPlan), col: COL_IDX.cadastralPlan },
      ];

      // Alto real de la fila: en vez de truncar con "…", el texto que no cabe en una línea
      // se envuelve a varias (ver `doc.text` más abajo, sin `ellipsis`/`lineBreak: false`) y
      // la fila crece para mostrarlo completo — se mide ANTES de dibujar para (a) decidir el
      // salto de página con el alto real, no uno fijo que se quedaba corto, y (b) que el
      // texto dibujado nunca desborde el alto de la fila ni dispare el salto de página
      // automático de pdfkit descrito arriba (PDF_CELL_TEXT_HEIGHT).
      let maxTextHeight = 0;
      rowData.forEach(({ val, col, bold }) => {
        const colDef = PDF_COLS.at(col);
        doc.fontSize(7).font(bold ? 'Helvetica-Bold' : 'Helvetica');
        const h = doc.heightOfString(val, { width: colDef.width - 6 });
        if (h > maxTextHeight) maxTextHeight = h;
      });
      const ROW_H = Math.max(MIN_ROW_H, maxTextHeight + ROW_V_PADDING);

      if (y + ROW_H > doc.page.height - 40) {
        drawPDFFooter(doc);
        doc.addPage({ layout: 'landscape' });
        await drawPDFHeader(doc, properties, generatedAt, logoPath);
        y = drawPDFTableHeader(doc, 80);
      }

      doc.rect(40, y, doc.page.width - 80, ROW_H).fill(i % 2 === 0 ? BG_ALT : '#ffffff');

      // Foto de portada — ya viene recortada a cuadrado desde Cloudinary (buildThumbnailUrl),
      // centrada tanto horizontal como verticalmente dentro de su columna/fila (la fila ya
      // no tiene un alto fijo, así que el alto fijo previo dejaría la miniatura descentrada
      // en filas más altas por texto largo en otra celda).
      const photoBuf = coverBuffers[i];
      if (photoBuf) {
        try {
          const colDef = PDF_COLS[COL_IDX.photo];
          const thumbSize = Math.min(ROW_H - 4, 48);
          const thumbX = xPositions[COL_IDX.photo] + (colDef.width - thumbSize) / 2;
          const thumbY = y + (ROW_H - thumbSize) / 2;
          doc.image(photoBuf, thumbX, thumbY, { width: thumbSize, height: thumbSize });
        } catch {
          /* ignorado */
        }
      }

      rowData.forEach(({ val, col, bold, color }) => {
        const colDef = PDF_COLS.at(col);
        const xPos = xPositions.at(col) + 3;
        const wid = colDef.width - 6;
        let fillColor = TEXT;
        if (color) fillColor = color;
        doc
          .fillColor(fillColor)
          .fontSize(7)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, xPos, y + 7, { width: wid });
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
const feedbackStatusLabel = { nuevo: 'Nuevo', leido: 'Leído' };

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
    const statusArgbFeedback = { nuevo: 'FF3B82F6', leido: ST_YELLOW_ARGB };

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
const paymentMethodLabel = { credito_hipotecario: 'Crédito', contado: 'Contado' };

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
      // Rediseño CRM — criterios de búsqueda estructurados. Van después de "Notas" (columna
      // 13), no antes de la columna 7 ("Estatus"), que tiene un color hardcodeado por índice
      // (ver row.getCell(7) más abajo).
      { header: 'Ciudad buscada', key: 'searchCity', width: 16 },
      { header: 'Zona buscada', key: 'searchZone', width: 20 },
      { header: 'Tipo buscado', key: 'desiredType', width: 16 },
      { header: 'Urgencia', key: 'urgency', width: 14 },
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
        searchCity: lead.searchCity ? cityLabel[lead.searchCity] || lead.searchCity : '—',
        searchZone: dash(lead.searchZone),
        desiredType: lead.desiredType ? typeLabel[lead.desiredType] || lead.desiredType : '—',
        urgency: lead.urgency ? leadUrgencyLabel[lead.urgency] || lead.urgency : '—',
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
// EXCEL/PDF — Lista de espera
// ─────────────────────────────────────────────────────────────────────────────

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
      .text(col.label, x + 3, y + 6, {
        width: col.width - 6,
        height: PDF_CELL_TEXT_HEIGHT,
        ellipsis: true,
        lineBreak: false,
      });
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
            height: PDF_CELL_TEXT_HEIGHT,
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
// `weight` es el ancho relativo de cada columna, no puntos absolutos — se escalan en
// catalogPdfCols(doc) para sumar exacto el ancho disponible de la página (doc.page.width -
// 80). Antes eran puntos fijos que sumaban más que el ancho real en A4 horizontal, por lo
// que la última columna (Baños) quedaba parcialmente fuera de la página.
const CATALOG_PDF_COLS = [
  { label: 'Título', weight: 180, key: 'title' },
  { label: 'Ciudad', weight: 90, key: 'city' },
  { label: 'Tipo', weight: 80, key: 'type' },
  { label: 'Categoría', weight: 90, key: 'category' },
  { label: 'Precio', weight: 100, key: 'price' },
  { label: 'M² Terreno', weight: 70, key: 'terrainMeters' },
  { label: 'M² Constr.', weight: 70, key: 'constructionMeters' },
  { label: 'Recámaras', weight: 65, key: 'bedrooms' },
  { label: 'Baños', weight: 65, key: 'bathrooms' },
];

// Convierte los pesos relativos de CATALOG_PDF_COLS en anchos absolutos que suman exacto el
// ancho disponible de la página (`doc.page.width - 80`, mismo cálculo que ya usaba
// drawCatalogPDFTableHeader para el fondo del encabezado) — así la tabla siempre llena el
// espacio real de la página sin desbordar, sea cual sea el tamaño/orientación del doc.
const catalogPdfCols = (doc) => {
  const pw = doc.page.width - 80;
  const totalWeight = CATALOG_PDF_COLS.reduce((sum, c) => sum + c.weight, 0);
  const cols = CATALOG_PDF_COLS.map((c) => ({
    ...c,
    width: Math.floor((c.weight / totalWeight) * pw),
  }));
  // El redondeo hacia abajo deja sobrantes de hasta unos pocos puntos — se le suman a la
  // primera columna (Título) para que el total cuadre exacto con `pw`.
  const usedWidth = cols.reduce((sum, c) => sum + c.width, 0);
  cols[0].width += pw - usedWidth;
  return cols;
};

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

// Mismo set que VALID_LEAD_TYPE en leadController.js (sin 'informacion'/'propiedades_similares'
// — valores históricos, ya no seleccionables en formularios nuevos).
const VALID_INTEREST_TYPES = [
  'comprar_propiedad',
  'rentar_propiedad',
  'vender_propiedad',
  'invertir_remates',
  'contacto',
  'cita',
  'asesoria_financiera',
  'otro',
];

// Crea el Lead que registra quién solicitó el catálogo — mismas reglas de validación que
// el formulario público "Contactar asesor" (leadController.createLead): nombre y teléfono
// requeridos, email opcional. `interest` (Interés) es obligatorio acá — a diferencia de
// ContactForm, que trae un default ('contacto'), este formulario no preselecciona nada. Se
// llama `interest` en el body (no `type`) porque ese nombre ya lo usa el filtro de tipo de
// propiedad (casa/depto/...) que viaja en el mismo POST — ver CatalogDownloadForm.jsx.
//
// `downloadEnabled` distingue si este prospecto SÍ recibió el PDF o solo quedó registrado
// porque el toggle de admin (ver settingsService.isInventoryDownloadEnabled) está
// desactivado — se refleja tanto en Lead.message (visible en las listas/tarjetas del CRM)
// como en una Activity tipo 'sistema' en su timeline (mismo mecanismo que usa el resto del
// CRM para eventos automáticos, ver leadController.createLead). Devuelve el Lead creado
// porque exportCatalogPDF necesita su id para la Activity.
const createCatalogDownloadLead = async ({ name, phone, email, interest }, downloadEnabled) => {
  if (!name || !name.trim()) throw new ApiError(400, 'Nombre es requerido');
  if (!phone || !validatePhone(phone))
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');
  if (email && !validateEmail(email)) throw new ApiError(400, 'Email inválido');
  if (!interest || !VALID_INTEREST_TYPES.includes(interest))
    throw new ApiError(400, 'Interés es requerido');

  const message = downloadEnabled
    ? 'Descargó el catálogo de propiedades (PDF)'
    : 'Solicitó el catálogo de propiedades (descarga automática desactivada)';

  const lead = await Lead.create({
    name: name.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : null,
    type: interest,
    source: 'directo',
    message,
  });

  await logActivity({
    leadId: lead.id,
    type: 'sistema',
    content: downloadEnabled
      ? 'Prospecto creado — descargó el catálogo de propiedades (PDF)'
      : 'Prospecto creado — solicitó el catálogo (descarga automática desactivada por admin)',
  });

  return lead;
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

const drawCatalogPDFTableHeader = (doc, y, cols) => {
  const pw = doc.page.width - 80;
  doc.rect(40, y, pw, 20).fill(PRIMARY);
  let x = 40;
  cols.forEach((col) => {
    doc
      .fillColor('white')
      .fontSize(7)
      .font('Helvetica-Bold')
      .text(col.label, x + 3, y + 6, {
        width: col.width - 6,
        height: PDF_CELL_TEXT_HEIGHT,
        ellipsis: true,
        lineBreak: false,
      });
    x += col.width;
  });
  return y + 20;
};

// POST /api/export/catalog/pdf — público, sin auth. Gateado por el flag de admin
// inventoryDownloadEnabled (ver settingsService/SettingsPage): el prospecto SIEMPRE se
// registra, pero el PDF solo se genera y entrega si el toggle está activado — cuando está
// desactivado se responde JSON (nunca el binario) y ni siquiera se consultan las
// propiedades ni se instancia PDFDocument, para no hacer trabajo innecesario (ver
// AUDITORIA_INVENTARIO_TOGGLE, punto 8).
const exportCatalogPDF = async (req, res) => {
  try {
    const downloadEnabled = await isInventoryDownloadEnabled();
    await createCatalogDownloadLead(req.body, downloadEnabled);

    if (!downloadEnabled) {
      return res.json({
        downloadAvailable: false,
        message:
          'Hemos recibido tus datos correctamente. El inventario de propiedades no está ' +
          'disponible para descarga automática en este momento — nuestro equipo se pondrá ' +
          'en contacto contigo para compartírtelo.',
      });
    }

    const properties = await getPublicCatalogProperties(req.body);
    const generatedAt = formatLongDateTime();

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-catalogo-${Date.now()}.pdf`);
    doc.pipe(res);

    const logoPath = getLogoPath();
    const cols = catalogPdfCols(doc);
    await drawCatalogPDFHeader(doc, properties, generatedAt, logoPath);
    let y = drawCatalogPDFTableHeader(doc, 80, cols);

    const xPositions = [];
    let acc = 40;
    cols.forEach((c) => {
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
        y = drawCatalogPDFTableHeader(doc, 80, cols);
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
        const colDef = cols[colIdx];
        doc
          .fillColor(TEXT)
          .fontSize(7)
          .font('Helvetica')
          .text(stripUnsupported(String(val)), xPositions[colIdx] + 3, y + 6, {
            width: colDef.width - 6,
            height: PDF_CELL_TEXT_HEIGHT,
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
  exportWaitingListExcel,
  exportWaitingListPDF,
  exportCatalogPDF,
};
