const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// CRM Comercial — Fase 1. Reemplaza Lead.appointmentDate como fuente de verdad de citas —
// CalendarPage.jsx lee de aquí. rescheduledFromId conserva el enlace a la cita anterior al
// reagendar, en vez de sobreescribir la fecha y perder el historial (ver
// appointmentController.rescheduleAppointment).
const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  propertyId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('programada', 'confirmada', 'completada', 'no_show', 'cancelada'),
    defaultValue: 'programada',
  },
  outcome: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  rescheduledFromId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'appointments',
  timestamps: true,
});

module.exports = Appointment;
