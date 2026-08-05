const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const LeadNote = sequelize.define(
  'LeadNote',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    authorName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    // FK real al autor — a diferencia de authorName (que se conserva intacta como
    // snapshot de despliegue para notas históricas y como fallback de display si el
    // usuario luego se elimina). Nulo para notas anteriores a esta columna (no se puede
    // reconstruir de forma confiable a partir de authorName).
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'lead_notes',
    timestamps: true,
  }
);

module.exports = LeadNote;
