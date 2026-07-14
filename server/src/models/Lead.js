const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const { validatePhone } = require('../utils/validators');

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    // CRM Comercial: pasa a opcional — un prospecto que llega solo por WhatsApp/Facebook
    // frecuentemente no tiene correo; exigirlo forzaba a inventar valores falsos.
    type: DataTypes.STRING(150),
    allowNull: true,
    validate: { isEmail: true },
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
    validate: {
      isValidPhone(value) {
        if (!validatePhone(value)) throw new Error('Teléfono inválido');
      },
    },
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM('contacto', 'cita', 'informacion'),
    defaultValue: 'contacto',
  },
  // CRM Comercial: deprecado a favor de pipelineStage (embudo de 8 etapas). Se conserva
  // sin borrar y se sigue backfillando por compatibilidad durante la transición — no leer
  // este campo en código nuevo.
  status: {
    type: DataTypes.ENUM('nuevo', 'contactado', 'cerrado', 'descartado'),
    defaultValue: 'nuevo',
  },
  pipelineStage: {
    type: DataTypes.ENUM(
      'nuevo', 'contactado', 'interesado', 'cita_agendada',
      'cita_realizada', 'negociacion', 'venta_realizada', 'no_interesado'
    ),
    defaultValue: 'nuevo',
    allowNull: false,
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assignedToUserId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  closeReason: {
    type: DataTypes.ENUM(
      'compro', 'no_respondio', 'sin_presupuesto',
      'compro_competencia', 'solo_info', 'perdio_interes', 'otro'
    ),
    allowNull: true,
  },
  closeReasonDetail: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  appointmentDate: {
    // CRM Comercial: deprecado a favor de la entidad Appointment (soporta reagendar sin
    // perder historial). Se conserva por compatibilidad con datos históricos.
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha solicitada para cita (deprecado, ver modelo Appointment)',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas internas del agente',
  },
  source: {
    type: DataTypes.ENUM('google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'),
    defaultValue: 'directo',
    allowNull: false,
  },
}, {
  tableName: 'leads',
  timestamps: true,
});

module.exports = Lead;