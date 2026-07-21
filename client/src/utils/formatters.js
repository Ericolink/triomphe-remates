export const formatPrice = (price) =>
  price === null || price === undefined || price === ''
    ? 'PENDIENTE'
    : new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
      }).format(price);

export const formatDate = (date, fallback = '—') =>
  date
    ? new Date(date).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : fallback;

export const formatDateTime = (date, fallback = '—') =>
  date
    ? new Date(date).toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : fallback;

// Deja solo dígitos y antepone 52 si es un número mexicano de 10 dígitos sin lada —
// mismo criterio que validatePhone en el backend (server/src/utils/validators.js).
export const toWhatsAppLink = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${withCountry}`;
};

// Monto disponible de un prospecto: distingue "no especificó" (explícito) de "sin dato"
// (no se ha preguntado/guardado todavía) — ver Lead.budgetNotSpecified.
export const formatBudget = (amount, notSpecified) => {
  if (notSpecified) return 'No especificó';
  if (amount === null || amount === undefined || amount === '') return '—';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Fecha de hoy en formato YYYY-MM-DD, para el atributo `max` de inputs date que no deben
// aceptar fechas futuras (ej. fecha de primer contacto).
export const todayISODate = () => new Date().toISOString().split('T')[0];
