module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  testTimeout: 10000,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
