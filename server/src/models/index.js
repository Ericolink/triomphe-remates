const sequelize = require('../../config/db');
const User = require('./User');
const Property = require('./Property');
const Image = require('./Image');
const Lead = require('./Lead');
const Analytics = require('./Analytics');
const JobPosition = require('./JobPosition');
const JobApplication = require('./JobApplication');
const Feedback = require('./Feedback');

// Propiedades
Property.hasMany(Image, { foreignKey: 'propertyId', as: 'images', onDelete: 'CASCADE' });
Image.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

Property.hasMany(Lead, { foreignKey: 'propertyId', as: 'leads' });
Lead.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

Property.hasMany(Analytics, { foreignKey: 'propertyId', as: 'analytics', onDelete: 'CASCADE' });
Analytics.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Bolsa de trabajo
JobPosition.hasMany(JobApplication, { foreignKey: 'jobPositionId', as: 'applications', onDelete: 'SET NULL' });
JobApplication.belongsTo(JobPosition, { foreignKey: 'jobPositionId', as: 'position' });

module.exports = { sequelize, User, Property, Image, Lead, Analytics, JobPosition, JobApplication, Feedback };
