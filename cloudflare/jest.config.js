module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  moduleNameMapper: {
    '^@trivia/shared$': '<rootDir>/../shared/src/index.ts',
  },
};
