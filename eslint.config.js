import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

const flatRec = firebaseRulesPlugin.configs?.['flat/recommended'];
const pluginConfigs = Array.isArray(flatRec) ? flatRec : flatRec ? [flatRec] : [];

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*'],
  },
  ...pluginConfigs,
];
