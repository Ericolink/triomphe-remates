const sequelize = require('../../config/db');
const User = require('./User');
const Property = require('./Property');
const Image = require('./Image');
const Lead = require('./Lead');
const LeadNote = require('./LeadNote');
const Analytics = require('./Analytics');
const JobPosition = require('./JobPosition');
const JobApplication = require('./JobApplication');
const Feedback = require('./Feedback');
const PropertyAlert = require('./PropertyAlert');
const AuditLog = require('./AuditLog');
const PropertyStatusHistory = require('./PropertyStatusHistory');
const Testimonial = require('./Testimonial');
const Campaign = require('./Campaign');
const LeadProperty = require('./LeadProperty');
const Activity = require('./Activity');
const Appointment = require('./Appointment');
const Task = require('./Task');
const Deal = require('./Deal');

// Propiedades
Property.hasMany(Image, { foreignKey: 'propertyId', as: 'images', onDelete: 'CASCADE' });
Image.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

Property.hasMany(Lead, { foreignKey: 'propertyId', as: 'leads' });
Lead.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

Lead.hasMany(LeadNote, { foreignKey: 'leadId', as: 'leadNotes', onDelete: 'CASCADE' });
LeadNote.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

Property.hasMany(Analytics, { foreignKey: 'propertyId', as: 'analytics', onDelete: 'CASCADE' });
Analytics.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

Property.hasMany(PropertyStatusHistory, {
  foreignKey: 'propertyId',
  as: 'statusHistory',
  onDelete: 'CASCADE',
});
PropertyStatusHistory.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

Property.hasMany(Testimonial, {
  foreignKey: 'propertyId',
  as: 'testimonials',
  onDelete: 'SET NULL',
});
Testimonial.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

// Bolsa de trabajo
JobPosition.hasMany(JobApplication, {
  foreignKey: 'jobPositionId',
  as: 'applications',
  onDelete: 'SET NULL',
});
JobApplication.belongsTo(JobPosition, { foreignKey: 'jobPositionId', as: 'position' });

// CRM Comercial
Campaign.hasMany(Lead, { foreignKey: 'campaignId', as: 'leads' });
Lead.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });

User.hasMany(Lead, { foreignKey: 'assignedToUserId', as: 'assignedLeads' });
Lead.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedUser' });

User.hasMany(Lead, { foreignKey: 'createdByUserId', as: 'createdLeads' });
Lead.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdByUser' });

User.hasMany(LeadNote, { foreignKey: 'userId', as: 'authoredNotes' });
LeadNote.belongsTo(User, { foreignKey: 'userId', as: 'author' });

Lead.belongsToMany(Property, {
  through: LeadProperty,
  foreignKey: 'leadId',
  otherKey: 'propertyId',
  as: 'interestedProperties',
});
Property.belongsToMany(Lead, {
  through: LeadProperty,
  foreignKey: 'propertyId',
  otherKey: 'leadId',
  as: 'interestedLeads',
});

Lead.hasMany(Activity, { foreignKey: 'leadId', as: 'activities', onDelete: 'CASCADE' });
Activity.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
User.hasMany(Activity, { foreignKey: 'userId', as: 'activities' });
Activity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Lead.hasMany(Appointment, { foreignKey: 'leadId', as: 'appointments', onDelete: 'CASCADE' });
Appointment.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Property.hasMany(Appointment, { foreignKey: 'propertyId', as: 'appointments' });
Appointment.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });
Appointment.belongsTo(Appointment, { foreignKey: 'rescheduledFromId', as: 'rescheduledFrom' });
Appointment.hasOne(Appointment, { foreignKey: 'rescheduledFromId', as: 'rescheduledTo' });
Appointment.belongsTo(User, { foreignKey: 'createdByUserId', as: 'createdByUser' });

Lead.hasMany(Task, { foreignKey: 'leadId', as: 'tasks', onDelete: 'CASCADE' });
Task.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
User.hasMany(Task, { foreignKey: 'assignedToUserId', as: 'assignedTasks' });
Task.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'assignedTo' });

Lead.hasOne(Deal, { foreignKey: 'leadId', as: 'deal', onDelete: 'CASCADE' });
Deal.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Property.hasMany(Deal, { foreignKey: 'propertyId', as: 'deals' });
Deal.belongsTo(Property, { foreignKey: 'propertyId', as: 'property' });

module.exports = {
  sequelize,
  User,
  Property,
  Image,
  Lead,
  LeadNote,
  Analytics,
  JobPosition,
  JobApplication,
  Feedback,
  PropertyAlert,
  AuditLog,
  PropertyStatusHistory,
  Testimonial,
  Campaign,
  LeadProperty,
  Activity,
  Appointment,
  Task,
  Deal,
};
