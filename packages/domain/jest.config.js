/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node10', strict: true, target: 'ES2022', esModuleInterop: true }, diagnostics: { ignoreCodes: [151002] } }],
  },
};
