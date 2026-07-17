// Fuerza la BD de test (triomphe_test) en vez de la de desarrollo — DB_HOST/USER/PASSWORD
// se siguen tomando de .env (mismo servidor MySQL local), solo el nombre de la BD cambia.
// En CI, ci.yml ya inyecta estas mismas variables directamente, así que esto es redundante
// pero no las pisa (mismo valor).
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'triomphe_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key';
