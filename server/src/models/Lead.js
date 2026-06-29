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
    type: DataTypes.STRING(150),
    allowNull: false,
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
  status: {
    type: DataTypes.ENUM('nuevo', 'contactado', 'cerrado', 'descartado'),
    defaultValue: 'nuevo',
  },
  appointmentDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha solicitada para cita',
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