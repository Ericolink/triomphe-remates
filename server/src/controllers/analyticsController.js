const { Analytics, Property, Lead } = require('../models/index');
const { Op, fn, col, literal } = require('sequelize');

// GET /api/analytics/dashboard
const getDashboard = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Leads por semana — últimas 8 semanas
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    // Ninguna de estas 18 consultas depende del resultado de otra — solo de las fechas ya
    // calculadas arriba — así que se lanzan todas en paralelo en vez de una por una.
    const [
      totalProperties,
      availableProperties,
      apartadoProperties,
      soldProperties,
      propertiesByCity,
      propertiesByType,
      topProperties,
      totalViews,
      totalLeads,
      newLeads,
      closedLeads,
      leadsByStatusRaw,
      leadsByTypeRaw,
      leadsBySourceRaw,
      recentLeads,
      recentClosedLeads,
      leadsRaw,
      viewsRaw,
    ] = await Promise.all([
      Property.count(),
      Property.count({ where: { status: 'disponible' } }),
      Property.count({ where: { status: 'apartado' } }),
      Property.count({ where: { status: 'vendido' } }),
      Property.findAll({
        attributes: ['city', [fn('COUNT', col('id')), 'total']],
        group: ['city'],
        raw: true,
      }),
      Property.findAll({
        attributes: ['type', [fn('COUNT', col('id')), 'total']],
        group: ['type'],
        raw: true,
      }),
      Property.findAll({
        attributes: ['id', 'title', 'city', 'views', 'slug'],
        order: [['views', 'DESC']],
        limit: 5,
      }),
      Analytics.count({
        where: {
          event: 'view',
          createdAt: { [Op.gte]: thirtyDaysAgo },
        },
      }),
      Lead.count(),
      Lead.count({ where: { status: 'nuevo' } }),
      Lead.count({ where: { status: 'cerrado' } }),
      Lead.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'total']],
        group: ['status'],
        raw: true,
      }),
      Lead.findAll({
        attributes: ['type', [fn('COUNT', col('id')), 'total']],
        group: ['type'],
        raw: true,
      }),
      Lead.findAll({
        attributes: ['source', [fn('COUNT', col('id')), 'total']],
        group: ['source'],
        raw: true,
      }),
      // Embudo de conversión (últimos 30 días): vistas → leads → cerrados
      Lead.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      Lead.count({ where: { status: 'cerrado', createdAt: { [Op.gte]: thirtyDaysAgo } } }),
      Lead.findAll({
        attributes: [
          [fn('DATE', col('createdAt')), 'date'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where: { createdAt: { [Op.gte]: eightWeeksAgo } },
        group: [literal('DATE(createdAt)')],
        order: [[literal('DATE(createdAt)'), 'ASC']],
        raw: true,
      }),
      Analytics.findAll({
        attributes: [
          [fn('DATE', col('createdAt')), 'date'],
          [fn('COUNT', col('id')), 'count'],
        ],
        where: { event: 'view', createdAt: { [Op.gte]: eightWeeksAgo } },
        group: [literal('DATE(createdAt)')],
        order: [[literal('DATE(createdAt)'), 'ASC']],
        raw: true,
      }),
    ]);

    const leadsByStatus = ['nuevo', 'contactado', 'cerrado', 'descartado'].map((status) => ({
      status,
      total: parseInt(leadsByStatusRaw.find((r) => r.status === status)?.total || 0),
    }));

    const leadsByType = [
      'comprar_propiedad',
      'rentar_propiedad',
      'vender_propiedad',
      'invertir_remates',
      'contacto',
      'cita',
      'asesoria_financiera',
      'otro',
      'informacion',
      'propiedades_similares',
    ].map((type) => ({
      type,
      total: parseInt(leadsByTypeRaw.find((r) => r.type === type)?.total || 0),
    }));

    const leadsBySource = ['google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'].map(
      (source) => ({
        source,
        total: parseInt(leadsBySourceRaw.find((r) => r.source === source)?.total || 0),
      })
    );

    const conversionRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
    const viewToLeadRate = totalViews > 0 ? (recentLeads / totalViews) * 100 : 0;

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

    const [viewsByDay, eventCounts] = await Promise.all([
      Analytics.findAll({
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
      }),
      Analytics.findAll({
        where: { propertyId: req.params.id },
        attributes: ['event', [fn('COUNT', col('id')), 'total']],
        group: ['event'],
        raw: true,
      }),
    ]);

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
