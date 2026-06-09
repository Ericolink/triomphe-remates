export const formatPrice = (price) =>
  (price === null || price === undefined || price === '')
    ? 'PENDIENTE'
    : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);

export const formatDate = (date, fallback = '—') =>
  date
    ? new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : fallback;

export const formatDateTime = (date, fallback = '—') =>
  date
    ? new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : fallback;
