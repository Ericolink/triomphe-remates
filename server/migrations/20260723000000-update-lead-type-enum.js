'use strict';

// El formulario público "Contactar asesor" reemplaza sus motivos de contacto y retira
// 'informacion' ("Información del remate") de las opciones seleccionables. Se conserva
// en el ENUM (no se elimina) para no romper los leads históricos que ya tienen ese valor
// guardado — ver LEAD_TYPE_LABELS en client/src/utils/constants.js.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'type', {
      type: Sequelize.ENUM(
        'contacto',
        'cita',
        'informacion',
        'asesoria_financiera',
        'propiedades_similares',
        'vender_propiedad',
        'otro'
      ),
      defaultValue: 'contacto',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'type', {
      type: Sequelize.ENUM('contacto', 'cita', 'informacion'),
      defaultValue: 'contacto',
    });
  },
};
