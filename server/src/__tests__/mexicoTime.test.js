// AUDITORIA Fase 1 — hallazgo de timezone: "Hoy"/rangos se calculaban con la hora LOCAL DEL
// PROCESO de Node (no controlada en producción) y el bucketing por día en SQL agrupaba en
// UTC (sesión de MySQL fijada a +00:00) — ninguna de las dos es la hora de México. Estos
// tests fijan casos concretos donde una visita cerca de medianoche cambiaría de día según
// qué zona horaria se use, para probar que mexicoTime.js siempre resuelve al día de México.
const {
  mexicoDateKey,
  mexicoWeekStartKey,
  mexicoMidnightUtc,
  mexicoMidnightUtcFromParts,
  formatDateKeyLabel,
} = require('../utils/mexicoTime');

describe('mexicoTime', () => {
  describe('mexicoDateKey', () => {
    test('una visita a las 11:30 PM hora México (05:30 UTC del día siguiente) sigue siendo el día anterior', () => {
      // 15 ene 2026, 23:30 hora México (UTC-6) = 16 ene 2026, 05:30 UTC.
      const instant = new Date('2026-01-16T05:30:00Z');
      expect(mexicoDateKey(instant)).toBe('2026-01-15');
    });

    test('una visita justo a medianoche en México cae en el día que empieza, no en el anterior', () => {
      // 16 ene 2026, 00:00:01 hora México = 16 ene 2026, 06:00:01 UTC.
      const instant = new Date('2026-01-16T06:00:01Z');
      expect(mexicoDateKey(instant)).toBe('2026-01-16');
    });

    test('el mismo instante da un día distinto en UTC puro que en hora de México (la razón del bug)', () => {
      const instant = new Date('2026-01-16T05:30:00Z');
      expect(instant.toISOString().slice(0, 10)).toBe('2026-01-16'); // día UTC ingenuo
      expect(mexicoDateKey(instant)).toBe('2026-01-15'); // día real de México
    });
  });

  describe('mexicoWeekStartKey', () => {
    test('un miércoles cae en el lunes de esa misma semana', () => {
      // Miércoles 14 de enero de 2026 (hora México), ~10am.
      const instant = new Date('2026-01-14T16:00:00Z');
      expect(mexicoWeekStartKey(instant)).toBe('2026-01-12'); // lunes
    });

    test('un domingo (fin de la semana ISO) cae en el lunes ANTERIOR, no en uno futuro', () => {
      // Domingo 18 de enero de 2026 (hora México), ~10am.
      const instant = new Date('2026-01-18T16:00:00Z');
      expect(mexicoWeekStartKey(instant)).toBe('2026-01-12');
    });
  });

  describe('mexicoMidnightUtc', () => {
    test('daysFromToday=0 da un instante cuya hora en México es exactamente 00:00:00', () => {
      const midnight = mexicoMidnightUtc(0);
      // 00:00 hora México (UTC-6) = 06:00 UTC.
      expect(midnight.getUTCHours()).toBe(6);
      expect(midnight.getUTCMinutes()).toBe(0);
      expect(midnight.getUTCSeconds()).toBe(0);
    });

    test('es independiente de TZ del proceso: mismo resultado sin importar la zona horaria del entorno', () => {
      const originalTz = process.env.TZ;
      try {
        process.env.TZ = 'UTC';
        const a = mexicoMidnightUtc(0).getTime();
        process.env.TZ = 'America/New_York';
        const b = mexicoMidnightUtc(0).getTime();
        // No exactamente igual (el reloj avanza entre ambas llamadas), pero deben caer en el
        // mismo minuto — confirma que el resultado no depende de process.env.TZ.
        expect(Math.abs(a - b)).toBeLessThan(2000);
      } finally {
        process.env.TZ = originalTz;
      }
    });
  });

  describe('mexicoMidnightUtcFromParts', () => {
    test('construye la medianoche de México para una fecha de calendario exacta', () => {
      const start = mexicoMidnightUtcFromParts(2026, 1, 15);
      expect(mexicoDateKey(start)).toBe('2026-01-15');
      expect(start.toISOString()).toBe('2026-01-15T06:00:00.000Z');
    });
  });

  describe('formatDateKeyLabel', () => {
    test('formatea una clave YYYY-MM-DD sin volver a desplazarla', () => {
      // El separador exacto lo decide el motor ICU de Node (varía "15 ene" / "15-ene" entre
      // versiones) — lo que importa para el bug de timezone es que el día sea 15, no el 14
      // ni el 16.
      expect(formatDateKeyLabel('2026-01-15')).toMatch(/^15.ene$/);
    });
  });
});
