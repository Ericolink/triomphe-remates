const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { CITY_LABEL, PROPERTY_TYPE_LABEL, LEAD_TYPE_LABEL: typeLabel } = require('../utils/labels');
const { formatCurrency, formatLongDate, formatLongDateTime } = require('../utils/formatters');

const getLogoAttachment = async () => {
  const candidates = [
    path.join(__dirname, '../../../client/public/logo.png'),
    path.join(__dirname, '../../client/public/logo.png'),
    path.join(__dirname, '../client/public/logo.png'),
    path.join(__dirname, '../../public/logo.png'),
  ];
  const logoPath = candidates.find((p) => fs.existsSync(p));
  if (!logoPath) return null;
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
    const buffer = await img.getBuffer('image/png');
    return { filename: 'logo.png', content: buffer, cid: 'triomphe-logo' };
  } catch {
    return { filename: 'logo.png', path: logoPath, cid: 'triomphe-logo' };
  }
};

// Escapa caracteres especiales antes de interpolar datos de usuario en HTML de correo —
// los formularios públicos (leads, postulaciones, feedback, alertas) no sanitizan su input.
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const buildEmail = ({ title, subtitle, badge = '', body, cta = '', footerNote = '' }) => `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <div style="background:#22273A;padding:24px 32px;text-align:center">
        <img src="cid:triomphe-logo" alt="Triomphe Bienes Raíces" style="height:52px;width:auto;display:block;margin:0 auto 16px" />
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">${title}</h1>
        ${subtitle ? `<p style="margin:6px 0 0;color:#93c5fd;font-size:13px">${subtitle}</p>` : ''}
      </div>
      <div style="height:4px;background:linear-gradient(90deg,#D2A057 0%,#E4C48D 50%,#D2A057 100%)"></div>
      ${badge}
      <div style="padding:28px 32px">${body}</div>
      ${cta ? `<div style="padding:0 32px 28px;text-align:center">${cta}</div>` : ''}
      <div style="background:#22273A;padding:20px 32px;text-align:center">
        <p style="margin:0 0 6px;color:#D2A057;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Triomphe Bienes Raíces</p>
        <p style="margin:0;color:#7da8cc;font-size:11px;line-height:1.6">${footerNote || `Este correo fue generado automáticamente. ${formatLongDateTime()}.`}</p>
      </div>
    </div>
  </body>
  </html>
`;

const expLabel = {
  sin_experiencia: 'Sin experiencia',
  menos_1_año: 'Menos de 1 año',
  '1_3_años': '1 a 3 años',
  mas_3_años: 'Más de 3 años',
};

const ctaButton = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#D2A057;color:#22273A;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:700;letter-spacing:0.3px">${label}</a>`;

const tableRow = (label, value, last = false) =>
  `<tr${last ? '' : ' style="border-bottom:1px solid #f3f4f6"'}><td style="padding:8px 0;color:#6b7280;font-size:13px;width:130px">${label}</td><td style="padding:8px 0;font-size:13px">${value}</td></tr>`;

const messageBlock = (text) =>
  `<div style="margin-top:20px;background:#f8f9fa;border-radius:10px;padding:16px"><p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Mensaje</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.6">${text}</p></div>`;

const yellowBadge = (text) =>
  `<div style="background:#FBF3E7;padding:12px 32px;border-bottom:1px solid #E4C48D"><span style="color:#22273A;font-size:13px;font-weight:700">${text}</span></div>`;

const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Servicio de email configurado correctamente');
  } catch (error) {
    console.warn('⚠️  Email no configurado:', error.message);
  }
};

const sendNewLeadNotification = async (lead, property) => {
  const propertyRow = property
    ? tableRow(
        'Propiedad',
        `<strong style="color:#22273A">${escapeHtml(property.title)} — ${escapeHtml(CITY_LABEL[property.city] || property.city)}</strong>`
      )
    : '';
  const appointmentRow = lead.appointmentDate
    ? tableRow('Fecha cita', formatLongDate(lead.appointmentDate))
    : '';

  const html = buildEmail({
    title: '🔔 Nuevo lead recibido',
    subtitle: 'Triomphe Bienes Raíces — Panel de administración',
    badge: yellowBadge(`📋 ${escapeHtml(typeLabel[lead.type] || lead.type)}`),
    body: `
      <h2 style="margin:0 0 16px;color:#22273A;font-size:15px;font-weight:700">Datos del contacto</h2>
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Nombre', `<strong>${escapeHtml(lead.name)}</strong>`)}
        ${tableRow('Email', `<a href="mailto:${escapeHtml(lead.email)}" style="color:#22273A;text-decoration:none">${escapeHtml(lead.email)}</a>`)}
        ${lead.phone ? tableRow('Teléfono', `<a href="tel:${escapeHtml(lead.phone)}" style="color:#22273A;text-decoration:none">${escapeHtml(lead.phone)}</a>`) : ''}
        ${propertyRow}
        ${appointmentRow}
      </table>
      ${lead.message ? messageBlock(escapeHtml(lead.message)) : ''}
    `,
    cta: ctaButton(`${process.env.CLIENT_URL}/admin/leads`, 'Ver en el panel admin →'),
  });

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `🔔 Nuevo lead: ${lead.name} — ${typeLabel[lead.type] || lead.type}`,
    html,
    attachments: [await getLogoAttachment()].filter(Boolean),
  });
};

const sendLeadConfirmation = async (lead) => {
  const html = buildEmail({
    title: `¡Gracias por contactarnos, ${escapeHtml(lead.name)}!`,
    subtitle: 'Triomphe Bienes Raíces',
    body: `
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hemos recibido tu mensaje y uno de nuestros asesores se pondrá en contacto contigo
        a la brevedad posible, generalmente dentro de las próximas <strong>24 horas hábiles</strong>.
      </p>
      <div style="background:#EEF0F4;border-left:4px solid #22273A;border-radius:6px;padding:16px;margin:20px 0">
        <p style="margin:0;color:#22273A;font-size:13px;font-weight:600">Tu solicitud fue registrada como:</p>
        <p style="margin:6px 0 0;color:#374151;font-size:13px">${escapeHtml(typeLabel[lead.type] || lead.type)}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0">Si tienes alguna pregunta urgente puedes contactarnos:</p>
      <p style="margin:8px 0 0"><a href="mailto:${process.env.EMAIL_TO}" style="color:#22273A;font-size:13px;font-weight:600">${process.env.EMAIL_TO}</a></p>
    `,
    footerNote: `© ${new Date().getFullYear()} Triomphe Bienes Raíces — Especialistas en remates bancarios`,
  });

  await transporter.sendMail({
    from: `"Triomphe Bienes Raíces" <${process.env.EMAIL_USER}>`,
    to: lead.email,
    subject: `✅ Recibimos tu mensaje — Triomphe Bienes Raíces`,
    html,
    attachments: [await getLogoAttachment()].filter(Boolean),
  });
};

const sendJobApplicationNotification = async (application, position) => {
  const badge = position
    ? yellowBadge(`📋 Vacante: ${escapeHtml(position.title)}`)
    : `<div style="background:#e0f2fe;padding:12px 32px;border-bottom:1px solid #bae6fd"><span style="color:#0c4a6e;font-size:13px;font-weight:600">📋 Postulación general</span></div>`;

  const html = buildEmail({
    title: '👤 Nueva postulación recibida',
    subtitle: 'Bolsa de trabajo — Triomphe Bienes Raíces',
    badge,
    body: `
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Nombre', `<strong>${escapeHtml(application.name)}</strong>`)}
        ${tableRow('Email', `<a href="mailto:${escapeHtml(application.email)}" style="color:#22273A">${escapeHtml(application.email)}</a>`)}
        ${tableRow('Teléfono', `<a href="tel:${escapeHtml(application.phone)}" style="color:#22273A">${escapeHtml(application.phone)}</a>`)}
        ${tableRow('Ciudad', escapeHtml(CITY_LABEL[application.city] || application.city))}
        ${tableRow('Experiencia', escapeHtml(expLabel[application.experience] || application.experience))}
        ${tableRow('Vehículo propio', application.hasVehicle ? '✅ Sí' : '❌ No', true)}
      </table>
      ${application.motivation ? `<div style="margin-top:20px;background:#f8f9fa;border-radius:10px;padding:16px"><p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase">Motivación</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.6">${escapeHtml(application.motivation)}</p></div>` : ''}
    `,
    cta: ctaButton(`${process.env.CLIENT_URL}/admin/jobs`, 'Ver en el panel admin →'),
    footerNote: `Postulación recibida el ${formatLongDateTime()}`,
  });

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `👤 Nueva postulación: ${application.name}${position ? ` — ${position.title}` : ' (General)'}`,
    html,
    attachments: [await getLogoAttachment()].filter(Boolean),
  });
};

const sendJobApplicationConfirmation = async (application, position) => {
  const html = buildEmail({
    title: `¡Gracias por postularte, ${escapeHtml(application.name)}!`,
    subtitle: 'Triomphe Bienes Raíces — Bolsa de trabajo',
    body: `
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hemos recibido tu postulación${position ? ` para el puesto de <strong>${escapeHtml(position.title)}</strong>` : ''}. Nuestro equipo la revisará y se pondrá en contacto contigo a la brevedad posible.
      </p>
      <div style="background:#EEF0F4;border-left:4px solid #22273A;border-radius:6px;padding:16px;margin:20px 0">
        <p style="margin:0;color:#22273A;font-size:13px;font-weight:600">¿Qué sigue?</p>
        <p style="margin:6px 0 0;color:#374151;font-size:13px">Si tu perfil es de interés para nosotros, te contactaremos para agendar una entrevista.</p>
      </div>
    `,
    footerNote: `© ${new Date().getFullYear()} Triomphe Bienes Raíces`,
  });

  await transporter.sendMail({
    from: `"Triomphe Bienes Raíces" <${process.env.EMAIL_USER}>`,
    to: application.email,
    subject: `✅ Postulación recibida — Triomphe Bienes Raíces`,
    html,
    attachments: [await getLogoAttachment()].filter(Boolean),
  });
};

const categoryLabel = { queja: 'Queja', comentario: 'Comentario', sugerencia: 'Sugerencia' };
const categoryBadgeStyle = {
  queja: 'background:#fef2f2;border-bottom:1px solid #fecaca',
  comentario: 'background:#eff6ff;border-bottom:1px solid #bfdbfe',
  sugerencia: 'background:#f0fdf4;border-bottom:1px solid #bbf7d0',
};
const categoryTextColor = { queja: '#991b1b', comentario: '#1e40af', sugerencia: '#166534' };

const sendFeedbackNotification = async (feedback) => {
  const badgeStyle =
    categoryBadgeStyle[feedback.category] || 'background:#f3f4f6;border-bottom:1px solid #e5e7eb';
  const textColor = categoryTextColor[feedback.category] || '#374151';

  const html = buildEmail({
    title: '📬 Nuevo mensaje en el buzón',
    subtitle: 'Triomphe Bienes Raíces — Buzón de opiniones',
    badge: `<div style="padding:12px 32px;${badgeStyle}"><span style="color:${textColor};font-size:13px;font-weight:600">${escapeHtml(categoryLabel[feedback.category] || feedback.category)}</span></div>`,
    body: `
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Nombre', `<strong>${escapeHtml(feedback.name)}</strong>`)}
        ${tableRow('Email', `<a href="mailto:${escapeHtml(feedback.email)}" style="color:#22273A;text-decoration:none">${escapeHtml(feedback.email)}</a>`)}
        ${tableRow('Asunto', `<strong>${escapeHtml(feedback.subject)}</strong>`, true)}
      </table>
      ${messageBlock(escapeHtml(feedback.message))}
    `,
    cta: ctaButton(`${process.env.CLIENT_URL}/admin/buzon`, 'Ver en el panel admin →'),
  });

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `📬 ${categoryLabel[feedback.category] || feedback.category}: ${feedback.subject} — ${feedback.name}`,
    html,
    attachments: [await getLogoAttachment()].filter(Boolean),
  });
};

const sendPropertyAlertNotification = async (alert, property) => {
  const unsubscribeUrl = `${process.env.CLIENT_URL}/cancelar-alerta?token=${alert.token}`;
  const propertyUrl = `${process.env.CLIENT_URL}/propiedades/${property.slug}`;

  const html = buildEmail({
    title: '🏠 Nueva propiedad que podría interesarte',
    subtitle: 'Triomphe Bienes Raíces — Alertas de propiedades',
    body: `
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hola <strong>${escapeHtml(alert.name)}</strong>, encontramos una nueva propiedad que coincide con tus criterios de búsqueda.
      </p>
      <div style="background:#EEF0F4;border-left:4px solid #22273A;border-radius:6px;padding:16px;margin:16px 0">
        <p style="margin:0 0 4px;color:#22273A;font-size:15px;font-weight:700">${escapeHtml(property.title)}</p>
        <p style="margin:0;color:#374151;font-size:13px">${escapeHtml(CITY_LABEL[property.city] || property.city)} · ${escapeHtml(PROPERTY_TYPE_LABEL[property.type] || property.type)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Precio', `<strong style="color:#22273A">${formatCurrency(property.price, 'Consultar')}</strong>`)}
        ${property.constructionMeters ? tableRow('Construcción', `${property.constructionMeters} m²`) : ''}
        ${property.terrainMeters ? tableRow('Terreno', `${property.terrainMeters} m²`) : ''}
        ${property.bedrooms ? tableRow('Recámaras', property.bedrooms) : ''}
        ${tableRow('Estatus', 'Disponible', true)}
      </table>
    `,
    cta: ctaButton(propertyUrl, 'Ver propiedad →'),
    footerNote: `Recibiste este correo porque configuraste una alerta en Triomphe Bienes Raíces. <a href="${unsubscribeUrl}" style="color:#6b7280">Cancelar alerta</a>`,
  });

  await transporter.sendMail({
    from: `"Triomphe Bienes Raíces" <${process.env.EMAIL_USER}>`,
    to: alert.email,
    subject: `🏠 Nueva propiedad en ${CITY_LABEL[property.city] || property.city}: ${property.title}`,
    html,
    attachments: [await getLogoAttachment()].filter(Boolean),
  });
};

module.exports = {
  sendNewLeadNotification,
  sendLeadConfirmation,
  sendJobApplicationNotification,
  sendJobApplicationConfirmation,
  sendFeedbackNotification,
  sendPropertyAlertNotification,
  verifyConnection,
};
