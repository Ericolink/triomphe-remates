'use strict';

// Rediseño de Audit Log: dos problemas reales encontrados en el esquema actual.
//
// 1. `resource` es un ENUM que ya tuvo que extenderse una vez por migración
//    (20260714000007) y sigue incompleto: testimonialController.js registra
//    `resource: 'testimonial'`, que NO está en el ENUM — cada INSERT de esos falla
//    silenciosamente (logAudit solo hace catch+console.error) y nunca se guarda. Se
//    convierte a VARCHAR con validación a nivel de aplicación (ver
//    src/constants/auditTaxonomy.js) para eliminar esta clase de bug de raíz: un
//    recurso nuevo o mal escrito ya no se pierde en silencio.
// 2. No hay forma de distinguir un evento exitoso de uno fallido (ej. login fallido,
//    contraseña actual incorrecta) — se agrega `result`.
//
// Índices nuevos: `resource`/`action`/`userId`/`result` para los filtros del nuevo
// panel, y un FULLTEXT sobre (userName, userEmail, detail) para la búsqueda global.
//
// IMPORTANTE (ver hotfix 20260902000000 para properties): un índice que solo vive en
// la migración y no en el modelo se pierde en silencio cuando una base de datos nueva
// se bootstrapea vía sync() — por eso estos mismos índices también se declaran en
// src/models/AuditLog.js.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs MODIFY COLUMN resource VARCHAR(50) NOT NULL
    `);

    await queryInterface.addColumn('audit_logs', 'result', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'success',
    });

    await queryInterface.addIndex('audit_logs', ['resource'], { name: 'idx_audit_logs_resource' });
    await queryInterface.addIndex('audit_logs', ['action'], { name: 'idx_audit_logs_action' });
    await queryInterface.addIndex('audit_logs', ['userId'], { name: 'idx_audit_logs_user_id' });
    await queryInterface.addIndex('audit_logs', ['result'], { name: 'idx_audit_logs_result' });

    const [existingFulltext] = await queryInterface.sequelize.query(
      "SHOW INDEX FROM audit_logs WHERE Key_name = 'idx_audit_logs_fulltext'"
    );
    if (existingFulltext.length === 0) {
      await queryInterface.addIndex('audit_logs', {
        fields: ['userName', 'userEmail', 'detail'],
        type: 'FULLTEXT',
        name: 'idx_audit_logs_fulltext',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_fulltext');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_result');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_user_id');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_action');
    await queryInterface.removeIndex('audit_logs', 'idx_audit_logs_resource');

    await queryInterface.removeColumn('audit_logs', 'result');

    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs MODIFY COLUMN resource
      ENUM('property','lead','feedback','user','job','application','alert','campaign','activity','appointment','task','deal')
      NOT NULL
    `);
  },
};
