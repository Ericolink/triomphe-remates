// Única fuente de verdad para formateo de moneda/fecha reutilizado por
// exportHelpers.js, emailService.js, whatsappService.js. Antes cada archivo
// instanciaba su propio Intl.NumberFormat/toLocaleDateString con las mismas
// opciones — centralizado aquí para no tener que mantener N copias en sync.

const formatCurrency = (amount, fallback) => {
  if (amount === null || amount === undefined || amount === '') return fallback;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
};

// dd/mm/aaaa — formato usado en exports (Excel/PDF), distinto del "dd MMM aaaa"
// del cliente (client/src/utils/formatters.js) a propósito.
const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatPrice = (price) => formatCurrency(price, 'PENDIENTE');

// "03 de agosto de 2026" — usado en emails para fecha de cita/pie de página.
const formatLongDate = (date) =>
  new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

// "03 de agosto de 2026, 10:30" — usado en el pie de emails y en el
// "generado el" de las exportaciones Excel/PDF.
const formatLongDateTime = (date = new Date()) =>
  new Date(date).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

module.exports = {
  formatCurrency,
  formatPrice,
  formatDate,
  formatLongDate,
  formatLongDateTime,
};
