'use strict';

// CRM Comercial — Fase 1: campañas publicitarias de origen de un prospecto. Solo se
// almacenan datos propios de la campaña; métricas derivadas (prospectos generados, ventas,
// conversión, costo por venta) se calculan siempre al vuelo desde Lead/Deal, nunca se
// guardan aquí — evita el mismo problema de datos desactualizados que tenían los Excel.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('campaigns', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      platform: {
        type: Sequelize.ENUM('facebook', 'google', 'instagram', 'tiktok', 'otro'),
        allowNull: false,
      },
      name: { type: Sequelize.STRING(150), allowNull: false },
      startDate: { type: Sequelize.DATE, allowNull: false },
      endDate: { type: Sequelize.DATE, allowNull: true },
      budget: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('campaigns', ['platform'], { name: 'idx_campaigns_platform' });
    await queryInterface.addIndex('campaigns', ['startDate'], { name: 'idx_campaigns_start_date' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('campaigns');
  },
};
