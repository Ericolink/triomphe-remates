const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const typeLabel = { contacto: 'Solicitud de información', cita: 'Agendar visita', informacion: 'Información del remate' };

// Email al equipo cuando llega un lead nuevo
const sendNewLeadNotification = async (lead, property) => {
  const propertyInfo = property
    ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Propiedad</td><td style="padding:8px 0;font-size:13px;font-weight:600;color:#1a3a5c">${property.title} — ${cityLabel[property.city] || property.city}</td></tr>`
    : '';

  const appointmentInfo = lead.appointmentDate
    ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Fecha cita</td><td style="padding:8px 0;font-size:13px">${new Date(lead.appointmentDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</td></tr>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <div style="background:#1a3a5c;padding:28px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">
            🔔 Nuevo lead recibido
          </h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:13px">
            Triomphe Bienes Raíces — Panel de administración
          </p>
        </div>

        <!-- Badge tipo -->
        <div style="background:#fef3c7;padding:12px 32px;border-bottom:1px solid #fde68a">
          <span style="color:#92400e;font-size:13px;font-weight:600">
            📋 ${typeLabel[lead.type] || lead.type}
          </span>
        </div>

        <!-- Datos del lead -->
        <div style="padding:28px 32px">
          <h2 style="margin:0 0 16px;color:#1a3a5c;font-size:15px;font-weight:700">
            Datos del contacto
          </h2>
          <table style="width:100%;border-collapse:collapse">
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px">Nombre</td>
              <td style="padding:8px 0;font-size:13px;font-weight:600">${lead.name}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:8px 0;color:#6b7280;font-size:13px">Email</td>
              <td style="padding:8px 0;font-size:13px">
                <a href="mailto:${lead.email}" style="color:#1a3a5c;text-decoration:none">${lead.email}</a>
              </td>
            </tr>
            ${lead.phone ? `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 0;color:#6b7280;font-size:13px">Teléfono</td><td style="padding:8px 0;font-size:13px"><a href="tel:${lead.phone}" style="color:#1a3a5c;text-decoration:none">${lead.phone}</a></td></tr>` : ''}
            ${propertyInfo}
            ${appointmentInfo}
          </table>

          ${lead.message ? `
          <div style="margin-top:20px;background:#f8f9fa;border-radius:10px;padding:16px">
            <p style="margin:0 0 6px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Mensaje</p>
            <p style="margin:0;color:#374151;font-size:13px;line-height:1.6">${lead.message}</p>
          </div>` : ''}
        </div>

        <!-- CTA -->
        <div style="padding:0 32px 28px">
          <a href="${process.env.CLIENT_URL}/admin/leads"
            style="display:inline-block;background:#1a3a5c;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600">
            Ver en el panel admin →
          </a>
        </div>

        <!-- Footer -->
        <div style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #e5e7eb">
          <p style="margin:0;color:#9ca3af;font-size:11px">
            Este correo fue generado automáticamente por el sistema de Triomphe Bienes Raíces.
            Recibido el ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Triomphe Remates" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject: `🔔 Nuevo lead: ${lead.name} — ${typeLabel[lead.type] || lead.type}`,
    html,
  });
};

// Email de confirmación al cliente
const sendLeadConfirmation = async (lead) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <div style="max-width:580px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <div style="background:#1a3a5c;padding:28px 32px">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700">
            ¡Gracias por contactarnos, ${lead.name}!
          </h1>
          <p style="margin:6px 0 0;color:#93c5fd;font-size:13px">
            Triomphe Bienes Raíces
          </p>
        </div>

        <div style="padding:28px 32px">
          <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px">
            Hemos recibido tu mensaje y uno de nuestros asesores se pondrá en contacto contigo
            a la brevedad posible, generalmente dentro de las próximas <strong>24 horas hábiles</strong>.
          </p>

          <div style="background:#eff6ff;border-left:4px solid #1a3a5c;border-radius:6px;padding:16px;margin:20px 0">
            <p style="margin:0;color:#1a3a5c;font-size:13px;font-weight:600">Tu solicitud fue registrada como:</p>
            <p style="margin:6px 0 0;color:#374151;font-size:13px">${typeLabel[lead.type] || lead.type}</p>
          </div>

          <p style="color:#6b7280;font-size:13px;margin:16px 0 0">
            Si tienes alguna pregunta urgente puedes contactarnos directamente:
          </p>
          <p style="margin:8px 0 0">
            <a href="mailto:${process.env.EMAIL_TO}" style="color:#1a3a5c;font-size:13px;font-weight:600">${process.env.EMAIL_TO}</a>
          </p>
        </div>

        <div style="background:#f8f9fa;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center">
          <p style="margin:0;color:#9ca3af;font-size:11px">
            © ${new Date().getFullYear()} Triomphe Bienes Raíces — Especialistas en remates bancarios
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Triomphe Bienes Raíces" <${process.env.EMAIL_USER}>`,
    to: lead.email,
    subject: `✅ Recibimos tu mensaje — Triomphe Bienes Raíces`,
    html,
  });
};

const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Servicio de email configurado correctamente');
  } catch (error) {
    console.warn('⚠️  Email no configurado:', error.message);
  }
};

module.exports = { sendNewLeadNotification, sendLeadConfirmation, verifyConnection };
