'use strict';

// Segmentar el embudo comercial y "Desempeño por asesor" por línea de negocio (remates/
// infonavit/inversiones), pedido directo del dueño del negocio.
//
// `leads.businessLine` nuevo — a diferencia de Property, un Lead no siempre tiene una
// propiedad asociada (contacto general, WhatsApp), así que se elige manualmente al
// crear/editar el prospecto (decisión confirmada con el usuario) en vez de derivarse.
// Nullable: los leads existentes quedan sin valor y el reporte los agrupa aparte.
//
// A propósito NO se toca `properties.businessLine` (sigue en remate/infonavit únicamente):
// el selector de línea de negocio del formulario de propiedades (BUSINESS_LINE_TABS en
// PropertyFormPage.jsx) está documentado ahí como "debe leerse igual que el tab público"
// (PROPERTY_LINE_TABS en PropertiesPage.jsx) — agregar "inversion" al ENUM sin una sección
// pública para esa línea dejaría cualquier propiedad así etiquetada invisible en todo el
// sitio público (PropertiesPage/HomePage filtran por businessLine con esos 2 valores nada
// más). "Inversión" como línea de negocio queda acotado a leads, que no tienen ese problema.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'inversion'),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leads', 'businessLine');
  },
};
