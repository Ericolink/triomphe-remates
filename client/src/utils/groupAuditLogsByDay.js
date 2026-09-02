// Agrupa una lista de audit logs (ya ordenada por createdAt DESC, como la devuelve el
// backend) en secciones "HOY" / "AYER" / fecha larga — no existía ningún helper de
// agrupación por día en el proyecto (se buscó antes de escribir este).
function dayKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(date) {
  const today = dayKey(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const key = dayKey(date);

  if (key === today) return 'HOY';
  if (key === yesterday) return 'AYER';

  return new Date(date)
    .toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' })
    .toUpperCase();
}

export function groupAuditLogsByDay(logs) {
  const groups = [];
  let current = null;

  for (const log of logs) {
    const label = dayLabel(log.createdAt);
    if (!current || current.label !== label) {
      current = { label, key: dayKey(log.createdAt), logs: [] };
      groups.push(current);
    }
    current.logs.push(log);
  }

  return groups;
}
