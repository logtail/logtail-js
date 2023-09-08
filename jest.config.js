module.exports = {
  projects: [
    {
      displayName: 'Node',
      coverageDirectory: "coverage",
      coveragePathIgnorePatterns: ["node_modules/", "dist/"],
      globals: {
        "ts-jest": {
          tsConfig: "tsconfig.json"
        }
      },
      moduleDirectories: ["node_modules"],
      moduleFileExtensions: ["ts", "js"],
      testEnvironment: "node",
      testMatch: ["<rootDir>/packages/**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/", "/packages/edge/"],
      transform: {
        "^.+\\.ts$": "ts-jest"
      },
    },
    {
      displayName: 'Edge',
      coverageDirectory: "coverage",
      coveragePathIgnorePatterns: ["node_modules/", "dist/"],
      globals: {
        "ts-jest": {
          tsConfig: "tsconfig.json"
        }
      },
      moduleDirectories: ["node_modules"],
      moduleFileExtensions: ["ts", "js"],
      testEnvironment: "node", // TODO: switch to @edge-runtime/jest-environment
      testMatch: ["<rootDir>/packages/edge/**/*.test.ts"],
      testPathIgnorePatterns: ["/node_modules/", "/dist/"],
      transform: {
        "^.+\\.ts$": "ts-jest"
      },
    },
  ]
};
