import { env } from "$env/dynamic/private";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const start = (env.LOG_LEVEL === "verbose" || env.LOG_LEVEL === "debug") ? performance.now() : null;

  const response = await resolve(event);
  if (start != null) {
    console.log(
      "Request to",
      event.url.pathname,
      "processed in",
      performance.now() - start,
      "ms",
    );
  }
  return response;
};
