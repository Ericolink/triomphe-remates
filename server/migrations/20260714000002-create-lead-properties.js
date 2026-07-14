'use strict';

// CRM Comercial — Fase 1: tabla puente N:M. Un prospecto llega por una propiedad de origen
// (Lead.propertyId, sin cambios) pero durante el seguimiento suele pedir información de
// otras propiedades — esta tabla registra ese interés adicional sin duplicar el prospecto.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('lead_properties', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      leadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'leads', key: 'id' },
        onDelete: 'CASCADE',
      },
      propertyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'properties', key: 'id' },
        onDelete: 'CASCADE',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('lead_properties', ['leadId', 'propertyId'], {
      unique: true,
      name: 'lead_properties_lead_property_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('lead_properties');
  },
};
