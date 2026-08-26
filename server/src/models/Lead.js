const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const { validatePhone } = require('../utils/validators');

const Lead = sequelize.define(
  'Lead',
  {
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
    // 'informacion' y 'propiedades_similares' ya no son motivos seleccionables en
    // formularios nuevos (ver ContactForm.jsx / VALID_LEAD_TYPE en leadController) — se
    // conservan en el ENUM únicamente para no romper leads históricos que ya los tenían.
    type: {
      type: DataTypes.ENUM(
        'contacto',
        'cita',
        'informacion',
        'asesoria_financiera',
        'propiedades_similares',
        'vender_propiedad',
        'otro',
        'comprar_propiedad',
        'rentar_propiedad',
        'invertir_remates'
      ),
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
        'nuevo',
        'contactado',
        'interesado',
        'cita_agendada',
        'cita_realizada',
        'cita_con_seguimiento',
        'negociacion',
        'venta_realizada',
        'no_interesado'
      ),
      defaultValue: 'nuevo',
      allowNull: false,
    },
    campaignId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // createLead la infiere de Property.businessLine/category cuando el lead trae propertyId
    // (ver inferBusinessLineFromProperty en leadController.js) — igual editable a mano en el
    // CRM después, y sigue siendo opcional para leads sin propiedad (contacto general,
    // WhatsApp). null = sin línea de negocio asignada (leads previos a este campo, o
    // propiedades de categoría 'renta', que no tiene línea de negocio equivalente).
    businessLine: {
      type: DataTypes.ENUM('remate', 'infonavit', 'inversion', 'compra_venta'),
      allowNull: true,
    },
    assignedToUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Quién capturó el prospecto — null para envíos del formulario público "Contactar
    // asesor" (attachUserIfPresent no adjunta req.user sin token) y para leads creados
    // antes de esta columna. Determina el alcance de visibilidad de un Capturista (ver
    // getLeadVisibilityWhere en utils/leadAccess.js).
    createdByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Se actualiza cada vez que assignedToUserId cambia (incluido a null, que lo limpia).
    // Para leads ya asignados antes de esta columna existir, se hizo un backfill de mejor
    // esfuerzo con updatedAt en la migración — no representa la fecha real de la primera
    // asignación, solo la última modificación conocida al momento del deploy.
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closeReason: {
      type: DataTypes.ENUM(
        'compro',
        'no_respondio',
        'sin_presupuesto',
        'compro_competencia',
        'solo_info',
        'perdio_interes',
        'otro'
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
    paymentMethod: {
      type: DataTypes.ENUM('credito_hipotecario', 'contado'),
      allowNull: true,
    },
    budgetAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    // Distingue "no preguntado todavía" (budgetAmount null, budgetNotSpecified false) de
    // "se preguntó y el prospecto no lo dijo" (budgetNotSpecified true) — relevante para
    // métricas comerciales futuras sobre qué tan seguido se logra capturar el presupuesto.
    budgetNotSpecified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    firstContactDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment:
        'Fecha en que el prospecto contactó por primera vez (puede ser anterior a createdAt)',
    },
  },
  {
    tableName: 'leads',
    timestamps: true,
  }
);

module.exports = Lead;
