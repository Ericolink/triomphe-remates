'use strict';

// Permite ocultar del sitio público, propiedad por propiedad, cada uno de los 6 apartados
// del formulario admin (ver SECTIONS en PropertyFormPage.jsx) sin borrar los datos
// capturados — solo deja de mostrarlos. Default `true` en los 6: una propiedad existente o
// recién creada se sigue viendo exactamente igual que hoy hasta que alguien decida ocultar
// un apartado a propósito.
//
// `showLegalInfo`/`showValuationInfo` no tienen efecto visible todavía: esos 2 apartados
// (LT/MZ/portafolio/... y precios comerciales/utilidad) ya son 100% internos — ningún
// campo de esa sección se renderiza hoy en PropertyDetailPage ni PropertyCard. Se agregan
// de cualquier forma para que el formulario admin quede completo y listo si algún día se
// decide mostrar algo de ahí.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'showBasicInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar la descripción (Datos básicos) en la página pública',
    });

    await queryInterface.addColumn('properties', 'showLocationInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar dirección/colonia (Ubicación y tipo) en la página pública',
    });

    await queryInterface.addColumn('properties', 'showDetailsInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar m²/recámaras/baños (Detalles) en la página pública',
    });

    await queryInterface.addColumn('properties', 'showAuctionInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar el panel de precio e historial (Remate y estatus) en la página pública',
    });

    await queryInterface.addColumn('properties', 'showLegalInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Reservado — Datos catastrales y legales no se muestran hoy en ningún lado',
    });

    await queryInterface.addColumn('properties', 'showValuationInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Reservado — Valuación comercial no se muestra hoy en ningún lado',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'showValuationInfo');
    await queryInterface.removeColumn('properties', 'showLegalInfo');
    await queryInterface.removeColumn('properties', 'showAuctionInfo');
    await queryInterface.removeColumn('properties', 'showDetailsInfo');
    await queryInterface.removeColumn('properties', 'showLocationInfo');
    await queryInterface.removeColumn('properties', 'showBasicInfo');
  },
};
