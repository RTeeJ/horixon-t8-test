const path = require('node:path');

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  moduleNameMapper: { '^@coffee/domain$': '<rootDir>/../../packages/domain/src' },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs', moduleResolution: 'node10', ignoreDeprecations: '6.0', strict: true,
          strictPropertyInitialization: false, target: 'ES2022', esModuleInterop: true,
          experimentalDecorators: true, emitDecoratorMetadata: true, skipLibCheck: true, types: ['node', 'jest'],
          paths: { '@coffee/domain': [path.join(__dirname, '../../packages/domain/src')] },
        },
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  maxWorkers: 1, // e2e files share one Postgres and truncate order tables
  testTimeout: 60000,
};
