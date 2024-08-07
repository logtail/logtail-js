# Contributing

We are using `yarn` to manage dependencies.

1. `yarn install` to install dependencies
2. Run `yarn build` to build all packages
3. To run tests
   1. Run `yarn test` to run all tests
   2. To run tests for a single package, run for example `yarn test packages/node`
4. To use `example-project` with the locally built packages
   1. Make sure all dependencies are installed and all packages built
   2. Run `npm install` in the `/example-project` directory
   3. Run `yarn boostrap-example` in the root directory
   4. To run the example project, run `node index.js <source-token>` in the `/example-project` directory
