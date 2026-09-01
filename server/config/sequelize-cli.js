require('dotenv').config();

// AUDIT-010 (config separada del objeto Sequelize() de runtime, ver config/db.js) +
// incidente de la Fase 1 de analítica (2026-09-04): los tres bloques (development/test/
// production) apuntaban al MISMO DB_NAME de .env, así que `sequelize-cli --env test` sin
// ningún flag adicional corría en realidad contra la base de DESARROLLO. Un down() con un
// bug alteró triomphe_db pensando que era triomphe_test — ningún dato se perdió (solo se
// dropearon columnas, no filas), pero pudo haber sido mucho peor.
//
// Fix estructural (no solo documentar el riesgo): cada entorno ahora lee su PROPIA
// variable de base de datos, no la compartida DB_NAME —
//   - test        -> DB_NAME_TEST      (default 'triomphe_test' si no se define)
//   - development -> DB_NAME_DEVELOPMENT (default DB_NAME, para no romper instalaciones
//                    existentes que solo definen esa variable)
//   - production  -> DB_NAME_PRODUCTION  (default DB_NAME — en el deploy real de
//                    SmarterASP las variables vienen inyectadas por web.config, ver
//                    CLAUDE.md, así que este default rara vez se usa)
// Así, `--env test` YA NO PUEDE resolver accidentalmente a la base de desarrollo aunque
// alguien olvide pasar DB_NAME_TEST explícitamente: el default siempre es una base de test.
//
// Además, dos guardias en caliente abortan con un error claro (en vez de conectar en
// silencio a la base equivocada) ante las dos formas en que esto puede volver a salir mal:
//   1. Alguien fija DB_NAME_TEST a mano a algo que no tiene "test" en el nombre.
//   2. Alguien fija DB_NAME_DEVELOPMENT/DB_NAME a algo que SÍ lo tiene (el error inverso —
//      probablemente copiaron mal una variable).
const assertTestLikeName = (name, varLabel) => {
  if (!/test/i.test(name)) {
    throw new Error(
      `[sequelize-cli] Configuración peligrosa detectada: ${varLabel} resolvió a "${name}", ` +
        'que no contiene "test" en el nombre. Se aborta para evitar correr una migración de ' +
        'test contra una base que podría ser de desarrollo o producción. Revisa DB_NAME_TEST ' +
        'en tu .env.'
    );
  }
};

const assertNotTestLikeName = (name, varLabel) => {
  if (name && /test/i.test(name)) {
    throw new Error(
      `[sequelize-cli] Configuración peligrosa detectada: ${varLabel} resolvió a "${name}", ` +
        'que SÍ contiene "test" en el nombre — probablemente apunta por error a la base de ' +
        'test. Revisa tu .env.'
    );
  }
};

const testDbName = process.env.DB_NAME_TEST || 'triomphe_test';
assertTestLikeName(testDbName, 'DB_NAME_TEST');

const developmentDbName = process.env.DB_NAME_DEVELOPMENT || process.env.DB_NAME;
assertNotTestLikeName(developmentDbName, 'DB_NAME_DEVELOPMENT/DB_NAME');

const productionDbName = process.env.DB_NAME_PRODUCTION || process.env.DB_NAME;
assertNotTestLikeName(productionDbName, 'DB_NAME_PRODUCTION/DB_NAME');

const buildConfig = (database) => ({
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'mysql',
});

module.exports = {
  development: buildConfig(developmentDbName),
  test: buildConfig(testDbName),
  production: buildConfig(productionDbName),
};
