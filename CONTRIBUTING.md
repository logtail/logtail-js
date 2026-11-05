# Contributing

We are using `yarn` to manage dependencies.

1. `yarn install` to install dependencies
2. Run `yarn build` to build all packages
3. To run tests
   1. Run `yarn test` to run all tests
   2. To run tests for a single package, run for example `yarn test packages/node`
4. To use `example-project/node` with the locally built packages
   1. Make sure all dependencies are installed and all packages built
   2. Run `npm install` in the `example-project/node` directory
   3. Run `yarn bootstrap-example` in the root directory
   4. To run the example project, run `BETTER_STACK_SOURCE_TOKEN=<source-token> BETTER_STACK_INGESTING_HOST=<ingesting-host> node index.js` in the `example-project/node` directory
5. To run any example project with the packages packed as the release publishes them, as the E2E workflow does, run `bash e2e/client.sh pack` and then `EXAMPLE=example-project/<example> CLIENT_FROM=checkout bash e2e/client.sh install` in the root directory
