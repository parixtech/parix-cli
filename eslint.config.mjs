import antfu from '@antfu/eslint-config';

export default antfu(
  {
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: true,
    },
    ignores: ['node_modules', 'build', 'public'],
    rules: {
      'ts/no-require-imports': 'off', // Allow require imports
      'regexp/no-unused-capturing-group': 'warn',
      'no-console': 'warn', // Allow console statements
      'test/prefer-lowercase-title': 'off', // Disable lowercase title preference in tests
      'node/prefer-global/process': 'off', // Allow direct use of process
    },
  },
);
