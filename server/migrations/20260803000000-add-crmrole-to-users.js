'use strict';

// CRM de Leads — roles y visibilidad por fila. `crmRole` es un campo separado de `role`
// (admin/editor) a propósito: solo gatea autorización dentro del módulo de prospectos, y
// nunca debe leerse en ningún otro controller (propiedades, vacantes, testimonios,
// usuarios, auditoría, exports de propiedades siguen igual con `role`, sin cambios).
// Backfill: los usuarios `editor` existentes se migran a 'coordinador_ventas' para no
// perder acceso al CRM el día del deploy (decisión explícita del usuario) — un `editor`
// nuevo creado después de este deploy NO obtiene CRM por default, queda null hasta que un
// admin le asigne un rol de CRM explícitamente.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'crmRole', {
      type: Sequelize.ENUM('coordinador_ventas', 'capturista', 'asesor_ventas'),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.sequelize.query(
      `UPDATE users SET crmRole = 'coordinador_ventas' WHERE role = 'editor'`
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'crmRole');
  },
};
