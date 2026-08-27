const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return false;
  const domain = email.slice(atIndex + 1);
  if (!domain || !domain.includes('.')) return false;
  const dotIndex = domain.lastIndexOf('.');
  if (dotIndex < 1 || dotIndex === domain.length - 1) return false;
  return true;
};

// AUDIT-006: teléfono es opcional en leads/alertas, pero si viene debe ser un número
// mexicano válido (10 dígitos locales, con o sin +52/52 de prefijo) — antes no se validaba
// en ningún lado y llegaba sin formato a whatsappService.toE164.
const validatePhone = (phone) => {
  if (phone === null || phone === undefined || phone === '') return true;
  if (typeof phone !== 'string') return false;
  const digits = phone.replace(/[\s\-()]/g, '');
  let local = digits;
  if (local.startsWith('+52')) local = local.slice(3);
  else if (local.startsWith('52') && local.length > 10) local = local.slice(2);
  return /^\d{10}$/.test(local);
};

// Reduce un teléfono ya validado (validatePhone) a sus 10 dígitos locales, sin espacios/
// guiones/paréntesis ni prefijo 52/+52 — así "656-123-4567", "+526561234567" y "6561234567"
// comparan igual. Usado por leadController para detectar teléfonos duplicados entre
// prospectos que se capturaron con distinto formato. Devuelve null si no es un teléfono
// mexicano válido de 10 dígitos.
const normalizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/[\s\-()]/g, '');
  let local = digits;
  if (local.startsWith('+52')) local = local.slice(3);
  else if (local.startsWith('52') && local.length > 10) local = local.slice(2);
  return /^\d{10}$/.test(local) ? local : null;
};

const validatePassword = (password) => {
  return typeof password === 'string' && password.length >= 8;
};

const validateRegister = (data) => {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('El nombre es requerido');
  }
  if (!validateEmail(data.email)) errors.push('Email inválido');
  if (!validatePassword(data.password))
    errors.push('La contraseña debe tener al menos 8 caracteres');
  if (
    !data.role ||
    !['admin', 'coordinador_ventas', 'asesor_ventas', 'asistente_administrativo'].includes(
      data.role
    )
  )
    errors.push('Rol inválido');
  return errors;
};

const validateLogin = (data) => {
  const errors = [];
  if (!validateEmail(data.email)) errors.push('Email inválido');
  if (!data.password) errors.push('Contraseña requerida');
  return errors;
};

module.exports = { validateEmail, validatePhone, normalizePhone, validateRegister, validateLogin };
