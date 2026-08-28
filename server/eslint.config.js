const js = require('@eslint/js');
const eslintConfigPrettier = require('eslint-config-prettier');
const eslintPluginSecurity = require('eslint-plugin-security');

module.exports = [
  js.configs.recommended,
  eslintPluginSecurity.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Ruidoso casi al 100% en este código: se dispara con cualquier acceso por corchete
      // (array[i] de un índice numérico de loop, mapa[clave] con clave fija del propio
      // código), no solo con clave verdaderamente controlada por el usuario. El resto del
      // plugin de seguridad se queda activo (regex inseguro, rutas de archivo no literales,
      // etc. sí detectan riesgos reales).
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
];
