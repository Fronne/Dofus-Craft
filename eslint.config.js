import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'dist-admin', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,
  {
    rules: {
      // Both downgraded rather than fixed: they flag two patterns already used consistently
      // across this codebase (resetting state in an effect's early-return guard clause, and
      // colocating a context's provider component with its consumer hook in one file) that are
      // common, intentional React idioms here, not bugs — worth a look, not a build-breaker.
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
);
