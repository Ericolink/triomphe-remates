'use strict';

// CRM de Leads — roles y visibilidad por fila. Extiende el timeline de Activity (ya usado
// para "Responsable cambiado" como texto libre vía logActivity) con un tipo estructurado
// 'reasignacion' + las columnas previous/newAssignedToUserId, para poder consultar el
// historial de asignación de un lead sin parsear `content`. El actor ya se registra en
// `userId` (existente); la fecha, en `occurredAt` (existente).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('activities', 'type', {
      type: Sequelize.ENUM(
        'llamada',
        'whatsapp',
        'email',
        'visita',
        'nota',
        'sistema',
        'reasignacion'
      ),
      allowNull: false,
    });

    await queryInterface.addColumn('activities', 'previousAssignedToUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addColumn('activities', 'newAssignedToUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('activities', 'newAssignedToUserId');
    await queryInterface.removeColumn('activities', 'previousAssignedToUserId');
    // No se revierte el ENUM de `type`: si ya existen filas con 'reasignacion', achicar el
    // ENUM rompería la base en vez de solo deshacer esta migración (mismo criterio que el
    // `email` no revertido a NOT NULL en 20260714000001).
  },
};
