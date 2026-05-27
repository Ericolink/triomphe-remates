const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Property } = require('../models/index');

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const typeLabel = { casa: 'Casa', departamento: 'Departamento', terreno: 'Terreno', local: 'Local', bodega: 'Bodega' };
const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };

const formatPrice = (price) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);

const getFilteredProperties = async (query) => {
  const { city, type, status } = query;
  const where = {};
  if (city) where.city = city;
  if (type) where.type = type;
  if (status) where.status = status;

  return Property.findAll({
    where,
    order: [['city', 'ASC'], ['createdAt', 'DESC']],
    attributes: [
      'id', 'title', 'city', 'type', 'status', 'price',
      'squareMeters', 'bedrooms', 'bathrooms', 'address',
      'views', 'createdAt',
    ],
  });
};

// GET /api/export/excel
const exportExcel = async (req, res) => {
  try {
    const properties = await getFilteredProperties(req.query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Triomphe Bienes Raíces';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inventario', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Título
    sheet.mergeCells('A1:N1');
    sheet.getCell('A1').value = 'TRIOMPHE BIENES RAÍCES — Inventario de Remates Bancarios';
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5c' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    // Fecha
    sheet.mergeCells('A2:N2');
    sheet.getCell('A2').value = `Generado el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })} · Total: ${properties.length} propiedades`;
    sheet.getCell('A2').font = { size: 10, color: { argb: 'FF6b7280' } };
    sheet.getCell('A2').alignment = { horizontal: 'center' };
    sheet.getRow(2).height = 20;

    // Encabezados
    const headers = [
      { header: '#', key: 'id', width: 6 },
      { header: 'Título', key: 'title', width: 36 },
      { header: 'Ciudad', key: 'city', width: 14 },
      { header: 'Tipo', key: 'type', width: 14 },
      { header: 'Estatus', key: 'status', width: 13 },
      { header: 'Precio', key: 'price', width: 16 },
      { header: 'M²', key: 'squareMeters', width: 10 },
      { header: 'Recámaras', key: 'bedrooms', width: 12 },
      { header: 'Baños', key: 'bathrooms', width: 10 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Vistas', key: 'views', width: 9 },
      { header: 'Fecha alta', key: 'createdAt', width: 14 },
    ];

    sheet.columns = headers;

    const headerRow = sheet.getRow(3);
    headerRow.values = headers.map((h) => h.header);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a3a5c' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFc8a96e' } },
      };
    });

    // Datos
    const statusColors = { disponible: 'FF10b981', apartado: 'FFf59e0b', vendido: 'FFef4444' };

    properties.forEach((p, i) => {
      const row = sheet.addRow({
        id: p.id,
        title: p.title,
        city: cityLabel[p.city] || p.city,
        type: typeLabel[p.type] || p.type,
        status: statusLabel[p.status] || p.status,
        price: formatPrice(p.price),
        squareMeters: p.squareMeters ? `${p.squareMeters} m²` : '—',
        bedrooms: p.bedrooms || '—',
        bathrooms: p.bathrooms || '—',
        address: p.address || '—',
        views: p.views,
        createdAt: new Date(p.createdAt).toLocaleDateString('es-MX'),
      });

      row.height = 18;

      // Fila alterna
      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        });
      }

      // Color estatus
      const statusCell = row.getCell(5);
      statusCell.font = { bold: true, color: { argb: 'FF' + statusColors[p.status]?.slice(2) || 'FF000000' } };

      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFe5e7eb' } } };
      });
    });

    // Fila de totales
    const totalRow = sheet.addRow({
      id: '',
      title: `TOTAL: ${properties.length} propiedades`,
      city: '',
      type: '',
      status: '',
      price: '',
    });
    totalRow.getCell(2).font = { bold: true, color: { argb: 'FF1a3a5c' } };
    totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFc8a96e' } };
    totalRow.height = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-inventario-${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en exportExcel:', error);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
};

// GET /api/export/pdf
const exportPDF = async (req, res) => {
  try {
    const properties = await getFilteredProperties(req.query);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=triomphe-inventario-${Date.now()}.pdf`);
    doc.pipe(res);

    const primaryColor = '#1a3a5c';
    const accentColor = '#c8a96e';
    const pageWidth = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 70).fill(primaryColor);
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
      .text('TRIOMPHE BIENES RAÍCES', 40, 18);
    doc.fontSize(10).font('Helvetica')
      .text('Inventario de Remates Bancarios', 40, 40);
    doc.fontSize(9)
      .text(`Generado: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`, 40, 54);

    // Total badge
    doc.roundedRect(doc.page.width - 160, 18, 120, 34, 6).fill(accentColor);
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
      .text(`${properties.length} propiedades`, doc.page.width - 155, 27, { width: 110, align: 'center' });

    doc.moveDown(3);

    // Columnas
    const cols = [
      { label: 'Título', width: 180 },
      { label: 'Ciudad', width: 75 },
      { label: 'Tipo', width: 70 },
      { label: 'Estatus', width: 70 },
      { label: 'Precio', width: 90 },
      { label: 'M²', width: 45 },
      { label: 'Banco', width: 70 },
      { label: 'No. Crédito', width: 80 },
    ];

    const tableTop = 90;
    let y = tableTop;

    // Header de tabla
    doc.rect(40, y, pageWidth, 22).fill(primaryColor);
    let x = 40;
    cols.forEach((col) => {
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text(col.label, x + 4, y + 7, { width: col.width - 8 });
      x += col.width;
    });
    y += 22;

    // Filas
    const statusColors = { disponible: '#10b981', apartado: '#f59e0b', vendido: '#ef4444' };

    properties.forEach((p, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage({ layout: 'landscape' });
        y = 40;

        // Re-header en nueva página
        doc.rect(40, y, pageWidth, 22).fill(primaryColor);
        let xh = 40;
        cols.forEach((col) => {
          doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
            .text(col.label, xh + 4, y + 7, { width: col.width - 8 });
          xh += col.width;
        });
        y += 22;
      }

      const rowHeight = 20;
      const bgColor = i % 2 === 0 ? '#f8f9fa' : '#ffffff';
      doc.rect(40, y, pageWidth, rowHeight).fill(bgColor);

      const rowData = [
        p.title?.substring(0, 38) || '—',
        cityLabel[p.city] || p.city,
        typeLabel[p.type] || p.type,
        statusLabel[p.status] || p.status,
        formatPrice(p.price),
        p.squareMeters ? `${p.squareMeters}` : '—',
      ];

      let rx = 40;
      rowData.forEach((val, ci) => {
        const isStatus = ci === 3;
        doc.fillColor(isStatus ? (statusColors[p.status] || '#000') : '#374151')
          .fontSize(7.5)
          .font(isStatus ? 'Helvetica-Bold' : 'Helvetica')
          .text(val, rx + 4, y + 6, { width: cols[ci].width - 8 });
        rx += cols[ci].width;
      });

      // Línea separadora
      doc.moveTo(40, y + rowHeight).lineTo(40 + pageWidth, y + rowHeight)
        .strokeColor('#e5e7eb').lineWidth(0.5).stroke();

      y += rowHeight;
    });

    // Footer
    doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(primaryColor);
    doc.fillColor(accentColor).fontSize(8).font('Helvetica')
      .text('© Triomphe Bienes Raíces — Documento generado automáticamente', 40, doc.page.height - 24);

    doc.end();
  } catch (error) {
    console.error('Error en exportPDF:', error);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
};

module.exports = { exportExcel, exportPDF };
