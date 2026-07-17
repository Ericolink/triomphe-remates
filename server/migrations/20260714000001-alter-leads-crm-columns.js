'use strict';

// CRM Comercial — Fase 1: extiende `leads` (Lead sigue siendo el modelo/tabla técnica;
// "Prospecto" es solo la etiqueta de UI, ver CRM_UX_DESIGN.md). Cambios:
//  - `email` pasa a nullable: hoy es NOT NULL y rompe prospectos que solo llegan por
//    WhatsApp/Facebook sin correo (hallazgo de la revisión de UX, no existían filas NULL
//    previas así que el cambio es seguro sin backfill).
//  - `pipelineStage` reemplaza gradualmente a `status` (4 valores) con un embudo de 8 etapas.
//    `status` se conserva (deprecado, no se borra) para no romper código/reportes que aún lo
//    lean durante la transición; se hace un backfill único de status→pipelineStage.
//  - `campaignId`/`assignedToUserId`: FKs nullable (SET NULL) — un prospecto puede no tener
//    campaña de origen conocida ni responsable asignado todavía.
//  - `closeReason`/`closeReasonDetail`: solo se llenan al cerrar un prospecto como perdido
//    (ver closeLeadAsLost en leadController).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'email', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn('leads', 'campaignId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'campaigns', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('leads', 'assignedToUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('leads', 'pipelineStage', {
      type: Sequelize.ENUM(
        'nuevo', 'contactado', 'interesado', 'cita_agendada',
        'cita_realizada', 'negociacion', 'venta_realizada', 'no_interesado'
      ),
      allowNull: false,
      defaultValue: 'nuevo',
    });

    await queryInterface.addColumn('leads', 'closeReason', {
      type: Sequelize.ENUM(
        'compro', 'no_respondio', 'sin_presupuesto',
        'compro_competencia', 'solo_info', 'perdio_interes', 'otro'
      ),
      allowNull: true,
    });

    await queryInterface.addColumn('leads', 'closeReasonDetail', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Backfill único: mapea el status de 4 valores al nuevo embudo de 8. Los leads
    // históricos 'cerrado'/'descartado' no tienen Deal/closeReason retroactivo (no existían
    // aún) — los reportes deben tratar venta_realizada sin Deal asociado como "venta legacy
    // sin monto", no como un error.
    await queryInterface.sequelize.query(`
      UPDATE leads SET pipelineStage = CASE status
        WHEN 'nuevo' THEN 'nuevo'
        WHEN 'contactado' THEN 'contactado'
        WHEN 'cerrado' THEN 'venta_realizada'
        WHEN 'descartado' THEN 'no_interesado'
        ELSE 'nuevo'
      END
    `);

    await queryInterface.addIndex('leads', ['pipelineStage'], { name: 'idx_leads_pipeline_stage' });
    await queryInterface.addIndex('leads', ['campaignId'], { name: 'idx_leads_campaign_id' });
    await queryInterface.addIndex('leads', ['assignedToUserId'], { name: 'idx_leads_assigned_to_user_id' });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('leads', 'idx_leads_pipeline_stage');
    await queryInterface.removeIndex('leads', 'idx_leads_campaign_id');
    await queryInterface.removeIndex('leads', 'idx_leads_assigned_to_user_id');
    await queryInterface.removeColumn('leads', 'closeReasonDetail');
    await queryInterface.removeColumn('leads', 'closeReason');
    await queryInterface.removeColumn('leads', 'pipelineStage');
    await queryInterface.removeColumn('leads', 'assignedToUserId');
    await queryInterface.removeColumn('leads', 'campaignId');
    // No se revierte email a NOT NULL: podría haber filas NULL creadas después de este
    // deploy, y forzar el rollback rompería la base en vez de solo deshacer una migración.
  },
};
