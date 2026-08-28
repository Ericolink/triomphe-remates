'use strict';

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
        'no_interesado',
        'lista_espera'
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
        'cita_con_seguimiento',
        'negociacion',
        'venta_realizada',
        'no_interesado'
      ),
      allowNull: false,
      defaultValue: 'nuevo',
    });
  },
};
