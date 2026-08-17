const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const crypto = require('crypto');
const { validatePhone } = require('../utils/validators');

const PropertyAlert = sequelize.define(
  'PropertyAlert',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    // Nullable desde que existe `source: 'staff'` — una entrada de lista de espera
    // capturada por el equipo no siempre tiene correo. El flujo público (`subscribe`)
    // lo sigue exigiendo a nivel de controller.
    email: { type: DataTypes.STRING(150), allowNull: true, validate: { isEmail: true } },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Para notificaciones por WhatsApp',
      validate: {
        isValidPhone(value) {
          if (!validatePhone(value)) throw new Error('Teléfono inválido');
        },
      },
    },
    city: {
      type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro'),
      allowNull: true,
      comment: 'null = cualquier ciudad',
    },
    type: {
      type: DataTypes.ENUM('casa', 'departamento', 'terreno', 'local', 'bodega'),
      allowNull: true,
      comment: 'null = cualquier tipo',
    },
    minPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'null = sin límite inferior de precio',
    },
    maxPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'null = sin límite de precio',
    },
    // Distingue las suscripciones públicas del sitio (POST /api/alerts, sin auth) de las
    // entradas manuales de la lista de espera que captura el staff (POST /api/waiting-list,
    // admin) — ambas comparten tabla, motor de matching (alertService.js) y export.
    source: {
      type: DataTypes.ENUM('public', 'staff'),
      allowNull: false,
      defaultValue: 'public',
    },
    businessLine: {
      type: DataTypes.ENUM('remate', 'infonavit', 'inversion'),
      allowNull: true,
      comment: 'null = cualquier línea de negocio',
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Estado de la república (texto libre), como Property.state',
    },
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: () => crypto.randomBytes(32).toString('hex'),
    },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: 'property_alerts',
    timestamps: true,
    // Índice único con nombre fijo — mismo bug de Sequelize+MySQL que en Property.slug y
    // User.email (ver migración fix-duplicate-unique-indexes); aquí solo tenía 1 índice
    // todavía, se previene antes de que acumule duplicados en futuros ciclos alter:true.
    indexes: [{ unique: true, fields: ['token'], name: 'property_alerts_token_unique' }],
  }
);

module.exports = PropertyAlert;
