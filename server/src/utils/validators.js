const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

const validateRegister = (data) => {
  const errors = [];
  if (!data.name || data.name.trim().length < 2) errors.push('El nombre es requerido');
  if (!data.email || !validateEmail(data.email)) errors.push('Email inválido');
  if (!validatePassword(data.password)) errors.push('La contraseña debe tener al menos 8 caracteres');
  if (!data.role || !['admin', 'editor'].includes(data.role)) errors.push('Rol inválido');
  return errors;
};

const validateLogin = (data) => {
  const errors = [];
  if (!data.email || !validateEmail(data.email)) errors.push('Email inválido');
  if (!data.password) errors.push('Contraseña requerida');
  return errors;
};

module.exports = { validateRegister, validateLogin };
