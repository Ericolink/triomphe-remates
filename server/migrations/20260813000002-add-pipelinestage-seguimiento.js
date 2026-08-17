'use strict';

// Agrega la etapa `cita_con_seguimiento` al embudo comercial (8 → 9 etapas), pedido
// directo del dueño del negocio — va entre `cita_realizada` y `venta_realizada`. El resto
// de las claves del ENUM no cambian; solo el orden de despliegue (que vive en
// PIPELINE_STAGES/PIPELINE_STAGE_LABELS, no en la base de datos) y la etiqueta de
// `negociacion` ("Negociación/información") se actualizan en el código, no acá.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'pipelineStage', {
      type: Sequelize.ENUM(
        'nuevo',
        'contactado',
        'interesado',
        'cita_agendada',
        'cita_realizada',
        'cita_con_seguimiento',
        'negociacion',
        'venta_realizada',
        'no_interesado'
      ),
      allowNull: false,
      defaultValue: 'nuevo',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'pipelineStage', {
      type: Sequelize.ENUM(
        'nuevo',
        'contactado',
        'interesado',
        'cita_agendada',
        'cita_realizada',
        'negociacion',
        'venta_realizada',
        'no_interesado'
      ),
      allowNull: false,
      defaultValue: 'nuevo',
    });
  },
};
