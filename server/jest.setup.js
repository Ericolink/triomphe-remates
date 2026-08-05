// Fuerza la BD de test (triomphe_test) en vez de la de desarrollo — DB_HOST/USER/PASSWORD
// se siguen tomando de .env (mismo servidor MySQL local), solo el nombre de la BD cambia.
// En CI, ci.yml ya inyecta estas mismas variables directamente, así que esto es redundante
// pero no las pisa (mismo valor).
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'triomphe_test';
// >= 32 caracteres y fuera de la lista de secretos triviales de validateEnv.js, para que
// siga siendo válido si algún test llega a invocar validateEnvironment().
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key_for_jest_do_not_use_in_prod';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
