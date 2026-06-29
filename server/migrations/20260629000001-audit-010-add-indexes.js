'use strict';

// AUDIT-010: ningún modelo tenía índices explícitos — properties (listado público, el
// endpoint con más tráfico del sitio), leads, analytics (crece con cada vista pública) y
// audit_logs (sin purga) eran full table scan en cualquier filtro/orden frecuente.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('properties', ['status'], { name: 'idx_properties_status' });
    await queryInterface.addIndex('properties', ['city'], { name: 'idx_properties_city' });
    await queryInterface.addIndex('properties', ['isFeatured'], { name: 'idx_properties_is_featured' });
    await queryInterface.addIndex('properties', ['auctionDate'], { name: 'idx_properties_auction_date' });

    await queryInterface.addIndex('leads', ['status'], { name: 'idx_leads_status' });
    await queryInterface.addIndex('leads', ['propertyId'], { name: 'idx_leads_property_id' });

    await queryInterface.addIndex('analytics', ['createdAt'], { name: 'idx_analytics_created_at' });
    await queryInterface.addIndex('analytics', ['propertyId'], { name: 'idx_analytics_property_id' });

    await queryInterface.addIndex('audit_logs', ['createdAt'], { name: 'idx_audit_logs_created_at' });

    await queryInterface.addIndex('property_alerts', ['isActive'], { name: 'idx_property_alerts_is_active' });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('properties', 'idx_properties_status');
    await queryInterface.removeIndex('properties', 'idx_properties_city');
    await queryInterface.removeIndex('properties', 'idx_properties_is_featured');
    await queryInterface.removeIndex('properties', 'idx_properties_auction_date');

    await queryInterface.removeIndex('leads', 'idx_leads_status');
    await queryInterface.removeIndex('leads', 'idx_leads_property_id');

    await queryInterface.removeIndex('analytics', 'idx_analytics_created_at');
    await queryInterface.removeIndex('analytics', 'idx_analytics_property_id');

    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_created_at');

    await queryInterface.removeIndex('property_alerts', 'idx_property_alerts_is_active');
  },
};
