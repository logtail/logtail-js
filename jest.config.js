module.exports = {
  projects: [
    {
      displayName: "Node",
      coverageDirectory: "coverage",
      coveragePathIgnorePatterns: ["node_modules/", "dist/"],
      moduleDirectories: ["node_modules"],
      moduleFileExtensions: ["ts", "js"],
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/", "/packages/browser/", "/packages/edge/"],
      transform: {
        "^.+\\.ts$": ["ts-jest", "tsconfig.json"],
      },
    },
    {
      displayName: "Browser",
      coverageDirectory: "coverage",
      coveragePathIgnorePatterns: ["node_modules/", "dist/"],
      moduleDirectories: ["node_modules"],
      moduleFileExtensions: ["ts", "js"],
      // https://mswjs.io/docs/migrations/1.x-to-2.x#requestresponsetextencoder-is-not-defined-jest
      testEnvironment: "jest-fixed-jsdom",
      testMatch: ["<rootDir>/packages/browser/**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/"],
      transform: {
        "^.+\\.ts$": ["ts-jest", "tsconfig.json"],
      },
    },
    {
      displayName: "Edge",
      coverageDirectory: "coverage",
      coveragePathIgnorePatterns: ["node_modules/", "dist/"],
      moduleDirectories: ["node_modules"],
      moduleFileExtensions: ["ts", "js"],
      testEnvironment: "@edge-runtime/jest-environment",
      testMatch: ["<rootDir>/packages/edge/**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/"],
      transform: {
        "^.+\\.ts$": ["ts-jest", "tsconfig.json"],
      },
    },
  ],
};
