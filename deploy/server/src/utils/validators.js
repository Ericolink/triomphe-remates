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

const validatePassword = (password) => {
  return typeof password === 'string' && password.length >= 8;
};

const validateRegister = (data) => {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('El nombre es requerido');
  }
  if (!validateEmail(data.email)) errors.push('Email inválido');
  if (!validatePassword(data.password)) errors.push('La contraseña debe tener al menos 8 caracteres');
  if (!data.role || !['admin', 'editor'].includes(data.role)) errors.push('Rol inválido');
  return errors;
};

const validateLogin = (data) => {
  const errors = [];
  if (!validateEmail(data.email)) errors.push('Email inválido');
  if (!data.password) errors.push('Contraseña requerida');
  return errors;
};

module.exports = { validateEmail, validateRegister, validateLogin };
