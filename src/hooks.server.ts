import { LOG_LEVEL } from "$env/static/private";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = async ({ event, resolve }) => {
  const start = (LOG_LEVEL === "verbose" || LOG_LEVEL === "debug") ? performance.now() : null;

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
