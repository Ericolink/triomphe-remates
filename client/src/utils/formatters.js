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
// Única fuente de verdad para enlaces de WhatsApp: todo componente que arme un
// href a wa.me debe pasar por aquí, nunca replicar el sanitizado manualmente.
export const toWhatsAppLink = (phone, message) => {
  const digits = (phone || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${withCountry}${query}`;
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

// Icono de tarjeta/detalle con dato no capturado: mostrar "--" en vez de ocultar el icono,
// para que la estructura visual de habitaciones/baños/m² sea siempre consistente.
export const formatMetric = (value, suffix = '') =>
  value === null || value === undefined || value === '' ? '--' : `${value}${suffix}`;

// Días completos transcurridos desde `date` — usado por el indicador de "sin actividad"
// en el filtro de prospectos estancados (ver staleDays en ProspectosSection.jsx).
export const daysSince = (date) => {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
};

// "Ahora" / "Hace N minutos" / "Hace N horas" / "Ayer" / "Hace N días" — usado por la lista
// de sesiones activas para `lastActivity`. Más allá de una semana cae a formatDate(), donde
// una fecha relativa deja de ser útil. El valor completo (formatDateTime) va en el `title`
// del elemento que use esto, para consultarlo al pasar el cursor.
export const formatRelativeTime = (date, fallback = '—') => {
  if (!date) return fallback;
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} minuto${minutes === 1 ? '' : 's'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? '' : 's'}`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;

  return formatDate(date, fallback);
};
