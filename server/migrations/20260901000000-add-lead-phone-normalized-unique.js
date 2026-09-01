'use strict';

const { normalizePhone } = require('../src/utils/validators');

// DB-001: findDuplicatePhoneLead (leadController.js) hacía `Lead.findAll()` de la tabla
// completa en CADA creación/edición de lead con teléfono, comparando en JavaScript porque
// no había forma barata de normalizar en SQL las variantes de formato de `phone`
// ("656-123-4567" vs "+526561234567" vs "6561234567"). Esta migración agrega una columna
// `phoneNormalized` (10 dígitos, sin prefijo/separadores — mismo criterio que
// utils/validators.normalizePhone, que sigue siendo la ÚNICA fuente de verdad de la
// normalización: un hook en el modelo Lead la recalcula en cada save, no se duplica la
// lógica aquí como una expresión SQL) con índice ÚNICO, para que el controller pueda
// reemplazar el full-table-scan por un lookup indexado y para que la propia base de datos
// (no solo el código de aplicación) impida duplicados bajo requests simultáneos.
//
// Compatibilidad con datos existentes: se hace un backfill de `phoneNormalized` para cada
// lead ya existente. Si YA existieran duplicados reales entre leads existentes (posible,
// dado que la comprobación anterior era propensa a condiciones de carrera), el índice
// único fallaría al crearse — en vez de eso, el backfill deja el valor normalizado SOLO en
// el lead más antiguo de cada grupo duplicado (menor id) y en `null` en los demás. Esto no
// borra ni modifica ningún otro dato de esos leads; simplemente no quedan protegidos por la
// restricción única (ya eran duplicados desde antes de este cambio, no algo que esta
// migración cause) — se reportan por consola para que alguien los revise manualmente si
// hace falta.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'phoneNormalized', {
      type: Sequelize.STRING(10),
      allowNull: true,
      comment:
        'Teléfono reducido a 10 dígitos sin prefijo/separadores (ver utils/validators.normalizePhone) — mantenido por un hook del modelo, usado para detectar duplicados sin recorrer toda la tabla.',
    });

    const leads = await queryInterface.sequelize.query(
      'SELECT id, phone FROM leads ORDER BY id ASC',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const seenNormalizedToLeadId = new Map();
    const duplicateGroups = [];
    for (const lead of leads) {
      const normalized = normalizePhone(lead.phone);
      if (!normalized) continue; // sin teléfono válido — se queda null, no participa en la unicidad

      if (seenNormalizedToLeadId.has(normalized)) {
        // Ya existe un lead más antiguo con este mismo teléfono normalizado — se deja este
        // en null para no romper el índice único que se crea abajo.
        duplicateGroups.push({ normalized, keptLeadId: seenNormalizedToLeadId.get(normalized), skippedLeadId: lead.id });
        continue;
      }
      seenNormalizedToLeadId.set(normalized, lead.id);
      await queryInterface.sequelize.query(
        'UPDATE leads SET phoneNormalized = :normalized WHERE id = :id',
        { replacements: { normalized, id: lead.id } }
      );
    }

    if (duplicateGroups.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[migration 20260901000000] ${duplicateGroups.length} lead(s) con teléfono duplicado ya existente se dejaron con phoneNormalized=null (no participan en la restricción única). Detalle:`,
        JSON.stringify(duplicateGroups)
      );
    }

    await queryInterface.addIndex('leads', ['phoneNormalized'], {
      name: 'idx_leads_phone_normalized_unique',
      unique: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('leads', 'idx_leads_phone_normalized_unique');
    await queryInterface.removeColumn('leads', 'phoneNormalized');
  },
};
