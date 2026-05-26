const { Analytics, Property } = require('../models/index');
const { Op, fn, col, literal } = require('sequelize');

// GET /api/analytics/dashboard
const getDashboard = async (req, res) => {
  try {
    const totalProperties = await Property.count();
    const availableProperties = await Property.count({ where: { status: 'disponible' } });
    const apartadoProperties = await Property.count({ where: { status: 'apartado' } });
    const soldProperties = await Property.count({ where: { status: 'vendido' } });

    const propertiesByCity = await Property.findAll({
      attributes: ['city', [fn('COUNT', col('id')), 'total']],
      group: ['city'],
      raw: true,
    });

    const propertiesByType = await Property.findAll({
      attributes: ['type', [fn('COUNT', col('id')), 'total']],
      group: ['type'],
      raw: true,
    });

    const topProperties = await Property.findAll({
      attributes: ['id', 'title', 'city', 'views', 'slug'],
      order: [['views', 'DESC']],
      limit: 5,
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalViews = await Analytics.count({
      where: {
        event: 'view',
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
    });

    const { Lead } = require('../models/index');
    const totalLeads = await Lead.count();
    const newLeads = await Lead.count({ where: { status: 'nuevo' } });

    return res.json({
      data: {
        properties: {
          total: totalProperties,
          disponible: availableProperties,
          apartado: apartadoProperties,
          vendido: soldProperties,
        },
        byCity: propertiesByCity,
        byType: propertiesByType,
        topProperties,
        views: { last30Days: totalViews },
        leads: { total: totalLeads, new: newLeads },
      },
    });
  } catch (error) {
    console.error('Error en getDashboard:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/analytics/properties/:id
const getPropertyAnalytics = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const viewsByDay = await Analytics.findAll({
      where: {
        propertyId: req.params.id,
        event: 'view',
        createdAt: {
          [Op.gte]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'views'],
      ],
      group: [literal('DATE(createdAt)')],
      order: [[literal('DATE(createdAt)'), 'ASC']],
      raw: true,
    });

    return res.json({
      data: {
        property: { id: property.id, title: property.title, views: property.views },
        viewsByDay,
      },
    });
  } catch (error) {
    console.error('Error en getPropertyAnalytics:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getDashboard, getPropertyAnalytics };
