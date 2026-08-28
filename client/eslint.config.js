import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import eslintPluginSecurity from 'eslint-plugin-security';
import eslintConfigPrettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
      eslintPluginSecurity.configs.recommended,
      eslintConfigPrettier,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Ruidoso casi al 100% en este código: se dispara con cualquier acceso por corchete
      // (array[i] de un índice numérico de loop, mapa[clave] con clave fija del propio
      // código como variants[variant] o LABELS[field]), no solo con clave verdaderamente
      // controlada por el usuario. El resto del plugin de seguridad se queda activo.
      'security/detect-object-injection': 'off',
    },
  },
]);
