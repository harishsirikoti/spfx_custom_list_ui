const spfxProfile = require('@microsoft/eslint-config-spfx/lib/flat-profiles/react');

module.exports = [
  // Generated output (including the packaged solution and webpack dev bundles) is never linted.
  { ignores: ['sharepoint/**', 'dist/**', 'lib/**', 'lib-*/**', 'temp/**', 'release/**', 'jest-output/**'] },
  ...spfxProfile,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: './tsconfig.json'
      }
    }
  }
];
