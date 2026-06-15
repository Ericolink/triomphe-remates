const { Analytics, Property, Lead } = require('../models/index');
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

    const totalLeads = await Lead.count();
    const newLeads = await Lead.count({ where: { status: 'nuevo' } });
    const closedLeads = await Lead.count({ where: { status: 'cerrado' } });

    const leadsByStatusRaw = await Lead.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    });
    const leadsByStatus = ['nuevo', 'contactado', 'cerrado', 'descartado'].map((status) => ({
      status,
      total: parseInt(leadsByStatusRaw.find((r) => r.status === status)?.total || 0),
    }));

    const leadsByTypeRaw = await Lead.findAll({
      attributes: ['type', [fn('COUNT', col('id')), 'total']],
      group: ['type'],
      raw: true,
    });
    const leadsByType = ['contacto', 'cita', 'informacion'].map((type) => ({
      type,
      total: parseInt(leadsByTypeRaw.find((r) => r.type === type)?.total || 0),
    }));

    const leadsBySourceRaw = await Lead.findAll({
      attributes: ['source', [fn('COUNT', col('id')), 'total']],
      group: ['source'],
      raw: true,
    });
    const leadsBySource = ['google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'].map((source) => ({
      source,
      total: parseInt(leadsBySourceRaw.find((r) => r.source === source)?.total || 0),
    }));

    // Embudo de conversión (últimos 30 días): vistas → leads → cerrados
    const recentLeads = await Lead.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } });
    const recentClosedLeads = await Lead.count({ where: { status: 'cerrado', createdAt: { [Op.gte]: thirtyDaysAgo } } });
    const conversionRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
    const viewToLeadRate = totalViews > 0 ? (recentLeads / totalViews) * 100 : 0;

    // Leads por semana — últimas 8 semanas
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const leadsRaw = await Lead.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { createdAt: { [Op.gte]: eightWeeksAgo } },
      group: [literal('DATE(createdAt)')],
      order: [[literal('DATE(createdAt)'), 'ASC']],
      raw: true,
    });

    // Agrupar por semana (ISO week label: "Sem N")
    const weekMap = {};
    leadsRaw.forEach(({ date, count }) => {
      const d = new Date(date);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay() + 1); // lunes
      const key = startOfWeek.toISOString().slice(0, 10);
      weekMap[key] = (weekMap[key] || 0) + parseInt(count);
    });
    const leadsOverTime = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, count]) => {
        const d = new Date(date + 'T12:00:00');
        const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        return { date, label, count };
      });

    // Vistas por semana — últimas 8 semanas
    const viewsRaw = await Analytics.findAll({
      attributes: [
        [fn('DATE', col('createdAt')), 'date'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: { event: 'view', createdAt: { [Op.gte]: eightWeeksAgo } },
      group: [literal('DATE(createdAt)')],
      order: [[literal('DATE(createdAt)'), 'ASC']],
      raw: true,
    });
    const viewWeekMap = {};
    viewsRaw.forEach(({ date, count }) => {
      const d = new Date(date);
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay() + 1);
      const key = startOfWeek.toISOString().slice(0, 10);
      viewWeekMap[key] = (viewWeekMap[key] || 0) + parseInt(count);
    });
    const viewsOverTime = Object.entries(viewWeekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([date, count]) => {
        const d = new Date(date + 'T12:00:00');
        const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        return { date, label, count };
      });

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
        leads: { total: totalLeads, new: newLeads, closed: closedLeads },
        leadsByStatus,
        leadsByType,
        leadsBySource,
        conversion: {
          rate: Math.round(conversionRate * 10) / 10,
          viewToLeadRate: Math.round(viewToLeadRate * 10) / 10,
          funnel: { views: totalViews, leads: recentLeads, closed: recentClosedLeads },
        },
        leadsOverTime,
        viewsOverTime,
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

    const eventCounts = await Analytics.findAll({
      where: { propertyId: req.params.id },
      attributes: ['event', [fn('COUNT', col('id')), 'total']],
      group: ['event'],
      raw: true,
    });

    const totals = { views: 0, contacts: 0, shares: 0 };
    eventCounts.forEach((row) => {
      if (row.event === 'view') totals.views = parseInt(row.total, 10);
      if (row.event === 'contact') totals.contacts = parseInt(row.total, 10);
      if (row.event === 'share') totals.shares = parseInt(row.total, 10);
    });

    return res.json({
      data: {
        property: { id: property.id, title: property.title, views: property.views },
        viewsByDay,
        totals,
      },
    });
  } catch (error) {
    console.error('Error en getPropertyAnalytics:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getDashboard, getPropertyAnalytics };
