'use strict';

// Unifica los dos sistemas de rol que coexistían en `users` (`role` admin/editor +
// `crmRole` coordinador_ventas/capturista/asesor_ventas, este último solo usado por el
// módulo de CRM de leads) en un único campo `role` con 4 valores funcionales, pedidos
// directamente por el dueño del negocio: admin, coordinador_ventas, asesor_ventas,
// asistente_administrativo. A partir de esta migración `role` gatea TODO el sistema
// (antes `crmRole` solo gateaba leads) — ver server/src/utils/leadAccess.js y el resto
// de las rutas admin para el nuevo significado de cada valor.
//
// Redefinición importante de 'coordinador_ventas': antes significaba acceso total al CRM
// de leads (ver/asignar todos los prospectos). Desde esta migración en adelante ya NO
// tiene ningún acceso al CRM — el rol quedó redefinido para el control de inventario
// (ver + exportar propiedades) exclusivamente, por pedido explícito del dueño del negocio.
//
// Backfill (decisión del usuario, 2026-08-13):
//  - role='admin'                                  -> se mantiene 'admin'
//  - role='editor' AND crmRole='coordinador_ventas' -> 'coordinador_ventas'
//  - role='editor' AND crmRole='asesor_ventas'      -> 'asesor_ventas'
//  - role='editor' AND crmRole='capturista'         -> 'asistente_administrativo' (capturista
//    se elimina como rol, no tiene equivalente en la nueva lista)
//  - role='editor' AND crmRole IS NULL              -> 'asistente_administrativo' (es el rol
//    más parecido a lo que tenía un editor sin CRM: acceso de staff general sin gestión de
//    usuarios/auditoría)
//
// En una base de datos nueva (bootstrap desde sync(), ver checkPendingMigrations.js) esta
// migración se marca como aplicada sin ejecutar su up(), así que el backfill nunca corre
// contra datos reales de un editor legacy — no hay ninguno en una instalación nueva.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Paso 1: ampliar el ENUM para que 'role' acepte transitoriamente tanto los valores
    // viejos como los nuevos — MySQL exige que un valor exista en la definición de la
    // columna antes de poder escribirlo con UPDATE.
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM(
        'admin',
        'editor',
        'coordinador_ventas',
        'asesor_ventas',
        'asistente_administrativo'
      ),
      defaultValue: 'asistente_administrativo',
    });

    await queryInterface.sequelize.query(`
      UPDATE users
      SET role = CASE
        WHEN role = 'admin' THEN 'admin'
        WHEN role = 'editor' AND crmRole = 'coordinador_ventas' THEN 'coordinador_ventas'
        WHEN role = 'editor' AND crmRole = 'asesor_ventas' THEN 'asesor_ventas'
        WHEN role = 'editor' AND crmRole = 'capturista' THEN 'asistente_administrativo'
        WHEN role = 'editor' THEN 'asistente_administrativo'
        ELSE role
      END
    `);

    // Paso 2: angostar el ENUM a solo los 4 valores finales, ya sin filas 'editor'.
    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM(
        'admin',
        'coordinador_ventas',
        'asesor_ventas',
        'asistente_administrativo'
      ),
      defaultValue: 'asistente_administrativo',
    });

    await queryInterface.removeColumn('users', 'crmRole');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'crmRole', {
      type: Sequelize.ENUM('coordinador_ventas', 'capturista', 'asesor_ventas'),
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM(
        'admin',
        'editor',
        'coordinador_ventas',
        'asesor_ventas',
        'asistente_administrativo'
      ),
      defaultValue: 'editor',
    });

    await queryInterface.sequelize.query(`
      UPDATE users
      SET crmRole = CASE
        WHEN role = 'coordinador_ventas' THEN 'coordinador_ventas'
        WHEN role = 'asesor_ventas' THEN 'asesor_ventas'
        ELSE NULL
      END,
      role = CASE
        WHEN role = 'admin' THEN 'admin'
        ELSE 'editor'
      END
    `);

    await queryInterface.changeColumn('users', 'role', {
      type: Sequelize.ENUM('admin', 'editor'),
      defaultValue: 'editor',
    });
  },
};
