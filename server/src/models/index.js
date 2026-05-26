const sequelize = require('../../config/db');
const User = require('./User');
const Property = require('./Property');
const Image = require('./Image');
const Lead = require('./Lead');
const Analytics = require('./Analytics');

// Una propiedad tiene muchas imágenes
Property.hasMany(Image, { foreignKey: 'propertyId', as: 'images', onDelete: 'CASCADE' });
Image.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Una propiedad tiene muchos leads
Property.hasMany(Lead, { foreignKey: 'propertyId', as: 'leads' });
Lead.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Una propiedad tiene muchos registros de analytics
Property.hasMany(Analytics, { foreignKey: 'propertyId', as: 'analytics', onDelete: 'CASCADE' });
Analytics.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

module.exports = { sequelize, User, Property, Image, Lead, Analytics };