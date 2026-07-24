'use strict';

// El formulario público "Contactar asesor" reemplaza sus motivos de contacto por un
// listado de 8 opciones. 'vender_propiedad'/'contacto'/'cita'/'asesoria_financiera' se
// reutilizan (solo cambia el label mostrado en LEAD_TYPE_LABELS), y se agregan 3 valores
// nuevos: 'comprar_propiedad', 'rentar_propiedad', 'invertir_remates'. 'informacion' y
// 'propiedades_similares' se conservan en el ENUM (no se eliminan) para no romper los
// leads históricos que ya tienen esos valores guardados — ver LEAD_TYPE_LABELS en
// client/src/utils/constants.js.
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
        'otro',
        'comprar_propiedad',
        'rentar_propiedad',
        'invertir_remates'
      ),
      defaultValue: 'contacto',
    });
  },

  down: async (queryInterface, Sequelize) => {
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
};
