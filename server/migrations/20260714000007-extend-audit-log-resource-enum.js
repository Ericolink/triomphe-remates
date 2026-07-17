'use strict';

// CRM Comercial — Fase 1: logAudit(req, action, 'campaign'|'activity'|'appointment'|'task'|'deal', ...)
// necesita estos valores en el ENUM de audit_logs.resource. Sequelize no tiene un helper de
// "extender ENUM" — se usa ALTER TABLE MODIFY COLUMN, igual que el patrón ya usado en
// server.js/runMigrations() para otros ENUMs.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs MODIFY COLUMN resource
      ENUM('property','lead','feedback','user','job','application','alert','campaign','activity','appointment','task','deal')
      NOT NULL
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE audit_logs MODIFY COLUMN resource
      ENUM('property','lead','feedback','user','job','application','alert')
      NOT NULL
    `);
  },
};
