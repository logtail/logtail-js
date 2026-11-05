/**
 * This Cloudflare Worker showcases logging to Better Stack from an edge runtime with @logtail/edge
 *
 * For more information visit https://github.com/logtail/logtail-js
 */

import { Logtail } from "@logtail/edge";

export default {
  async fetch(request, env, ctx) {
    // Create a Better Stack client with the source token and ingesting host from the Worker's environment, and
    // give it the request's execution context: the Worker keeps running until the request's logs are sent
    const logger = new Logtail(env.BETTER_STACK_SOURCE_TOKEN, {
      endpoint: `https://${env.BETTER_STACK_INGESTING_HOST}`,
    }).withExecutionContext(ctx);

    // Send debug and info level logs
    logger.debug("I am using Better Stack!");
    logger.info("An interesting event occurred!");

    // Structured data is passed as the second argument
    logger.warn("Something is not quite right, better check on it.", {
      user: {
        username: "someuser",
        email: "someuser@example.com",
      },
      additional_info: {
        tried_accessing: "/url/of/error",
      },
    });

    try {
      throw new Error("Testing error");
    } catch (err) {
      logger.error("Oops! An runtime ERROR occurred!", err);
    }

    return new Response("All done! You can check your logs now.\n");
  },
};
