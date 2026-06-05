const nodemailer = require('nodemailer');
require('dotenv').config();

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
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
      <div style="background:#1a3a5c;padding:28px 32px">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">${title}</h1>
        <p style="margin:6px 0 0;color:#93c5fd;font-size:13px">${subtitle}</p>
      </div>
      ${badge}
      <div style="padding:28px 32px">${body}</div>
      ${cta ? `<div style="padding:0 32px 28px">${cta}</div>` : ''}
      <div style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #e5e7eb">
        <p style="margin:0;color:#9ca3af;font-size:11px">${footerNote || `Este correo fue generado automáticamente por el sistema de Triomphe Bienes Raíces. Recibido el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`}</p>
      </div>
    </div>
  </body>
  </html>
`;

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro', otra: 'Otra ciudad' };
const typeLabel = { contacto: 'Solicitud de información', cita: 'Agendar visita', informacion: 'Información del remate' };
const expLabel = { sin_experiencia: 'Sin experiencia', 'menos_1_año': 'Menos de 1 año', '1_3_años': '1 a 3 años', 'mas_3_años': 'Más de 3 años' };

const ctaButton = (href, label) =>
  `<a href="${href}" style="display:inline-block;background:#1a3a5c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600">${label}</a>`;

const tableRow = (label, value, last = false) =>
  `<tr${last ? '' : ' style="border-bottom:1px solid #f3f4f6"'}><td style="padding:8px 0;color:#6b7280;font-size:13px;width:130px">${label}</td><td style="padding:8px 0;font-size:13px">${value}</td></tr>`;

const messageBlock = (text) =>
  `<div style="margin-top:20px;background:#f8f9fa;border-radius:10px;padding:16px"><p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Mensaje</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.6">${text}</p></div>`;

const yellowBadge = (text) =>
  `<div style="background:#fef3c7;padding:12px 32px;border-bottom:1px solid #fde68a"><span style="color:#92400e;font-size:13px;font-weight:600">${text}</span></div>`;

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
    ? tableRow('Propiedad', `<strong style="color:#1a3a5c">${property.title} — ${cityLabel[property.city] || property.city}</strong>`)
    : '';
  const appointmentRow = lead.appointmentDate
    ? tableRow('Fecha cita', new Date(lead.appointmentDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }))
    : '';

  const html = buildEmail({
    title: '🔔 Nuevo lead recibido',
    subtitle: 'Triomphe Bienes Raíces — Panel de administración',
    badge: yellowBadge(`📋 ${typeLabel[lead.type] || lead.type}`),
    body: `
      <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:15px;font-weight:700">Datos del contacto</h2>
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Nombre', `<strong>${lead.name}</strong>`)}
        ${tableRow('Email', `<a href="mailto:${lead.email}" style="color:#1a3a5c;text-decoration:none">${lead.email}</a>`)}
        ${lead.phone ? tableRow('Teléfono', `<a href="tel:${lead.phone}" style="color:#1a3a5c;text-decoration:none">${lead.phone}</a>`) : ''}
        ${propertyRow}
        ${appointmentRow}
      </table>
      ${lead.message ? messageBlock(lead.message) : ''}
    `,
    cta: ctaButton(`${process.env.CLIENT_URL}/admin/leads`, 'Ver en el panel admin →'),
  });

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `🔔 Nuevo lead: ${lead.name} — ${typeLabel[lead.type] || lead.type}`,
    html,
  });
};

const sendLeadConfirmation = async (lead) => {
  const html = buildEmail({
    title: `¡Gracias por contactarnos, ${lead.name}!`,
    subtitle: 'Triomphe Bienes Raíces',
    body: `
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hemos recibido tu mensaje y uno de nuestros asesores se pondrá en contacto contigo
        a la brevedad posible, generalmente dentro de las próximas <strong>24 horas hábiles</strong>.
      </p>
      <div style="background:#eff6ff;border-left:4px solid #1a3a5c;border-radius:6px;padding:16px;margin:20px 0">
        <p style="margin:0;color:#1a3a5c;font-size:13px;font-weight:600">Tu solicitud fue registrada como:</p>
        <p style="margin:6px 0 0;color:#374151;font-size:13px">${typeLabel[lead.type] || lead.type}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:16px 0 0">Si tienes alguna pregunta urgente puedes contactarnos:</p>
      <p style="margin:8px 0 0"><a href="mailto:${process.env.EMAIL_TO}" style="color:#1a3a5c;font-size:13px;font-weight:600">${process.env.EMAIL_TO}</a></p>
    `,
    footerNote: `© ${new Date().getFullYear()} Triomphe Bienes Raíces — Especialistas en remates bancarios`,
  });

  await transporter.sendMail({
    from: `"Triomphe Bienes Raíces" <${process.env.EMAIL_USER}>`,
    to: lead.email,
    subject: `✅ Recibimos tu mensaje — Triomphe Bienes Raíces`,
    html,
  });
};

const sendJobApplicationNotification = async (application, position) => {
  const badge = position
    ? yellowBadge(`📋 Vacante: ${position.title}`)
    : `<div style="background:#e0f2fe;padding:12px 32px;border-bottom:1px solid #bae6fd"><span style="color:#0c4a6e;font-size:13px;font-weight:600">📋 Postulación general</span></div>`;

  const html = buildEmail({
    title: '👤 Nueva postulación recibida',
    subtitle: 'Bolsa de trabajo — Triomphe Bienes Raíces',
    badge,
    body: `
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Nombre', `<strong>${application.name}</strong>`)}
        ${tableRow('Email', `<a href="mailto:${application.email}" style="color:#1a3a5c">${application.email}</a>`)}
        ${tableRow('Teléfono', `<a href="tel:${application.phone}" style="color:#1a3a5c">${application.phone}</a>`)}
        ${tableRow('Ciudad', cityLabel[application.city] || application.city)}
        ${tableRow('Experiencia', expLabel[application.experience] || application.experience)}
        ${tableRow('Vehículo propio', application.hasVehicle ? '✅ Sí' : '❌ No', true)}
      </table>
      ${application.motivation ? `<div style="margin-top:20px;background:#f8f9fa;border-radius:10px;padding:16px"><p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase">Motivación</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.6">${application.motivation}</p></div>` : ''}
    `,
    cta: ctaButton(`${process.env.CLIENT_URL}/admin/jobs`, 'Ver en el panel admin →'),
    footerNote: `Postulación recibida el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
  });

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `👤 Nueva postulación: ${application.name}${position ? ` — ${position.title}` : ' (General)'}`,
    html,
  });
};

const sendJobApplicationConfirmation = async (application, position) => {
  const html = buildEmail({
    title: `¡Gracias por postularte, ${application.name}!`,
    subtitle: 'Triomphe Bienes Raíces — Bolsa de trabajo',
    body: `
      <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px">
        Hemos recibido tu postulación${position ? ` para el puesto de <strong>${position.title}</strong>` : ''}. Nuestro equipo la revisará y se pondrá en contacto contigo a la brevedad posible.
      </p>
      <div style="background:#eff6ff;border-left:4px solid #1a3a5c;border-radius:6px;padding:16px;margin:20px 0">
        <p style="margin:0;color:#1a3a5c;font-size:13px;font-weight:600">¿Qué sigue?</p>
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
  });
};

const categoryLabel = { queja: 'Queja', comentario: 'Comentario', sugerencia: 'Sugerencia' };
const categoryBadgeStyle = {
  queja:      'background:#fef2f2;border-bottom:1px solid #fecaca',
  comentario: 'background:#eff6ff;border-bottom:1px solid #bfdbfe',
  sugerencia: 'background:#f0fdf4;border-bottom:1px solid #bbf7d0',
};
const categoryTextColor = { queja: '#991b1b', comentario: '#1e40af', sugerencia: '#166534' };

const sendFeedbackNotification = async (feedback) => {
  const badgeStyle = categoryBadgeStyle[feedback.category] || 'background:#f3f4f6;border-bottom:1px solid #e5e7eb';
  const textColor = categoryTextColor[feedback.category] || '#374151';

  const html = buildEmail({
    title: '📬 Nuevo mensaje en el buzón',
    subtitle: 'Triomphe Bienes Raíces — Buzón de opiniones',
    badge: `<div style="padding:12px 32px;${badgeStyle}"><span style="color:${textColor};font-size:13px;font-weight:600">${categoryLabel[feedback.category] || feedback.category}</span></div>`,
    body: `
      <table style="width:100%;border-collapse:collapse">
        ${tableRow('Nombre', `<strong>${feedback.name}</strong>`)}
        ${tableRow('Email', `<a href="mailto:${feedback.email}" style="color:#1a3a5c;text-decoration:none">${feedback.email}</a>`)}
        ${tableRow('Asunto', `<strong>${feedback.subject}</strong>`, true)}
      </table>
      ${messageBlock(feedback.message)}
    `,
    cta: ctaButton(`${process.env.CLIENT_URL}/admin/buzon`, 'Ver en el panel admin →'),
  });

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `📬 ${categoryLabel[feedback.category] || feedback.category}: ${feedback.subject} — ${feedback.name}`,
    html,
  });
};

module.exports = { sendNewLeadNotification, sendLeadConfirmation, sendJobApplicationNotification, sendJobApplicationConfirmation, sendFeedbackNotification, verifyConnection };
