import { LOG_LEVEL } from "$env/static/private";
import { auth } from "$lib/auth";
import { sequence } from "@sveltejs/kit/hooks";
import type { Handle } from "@sveltejs/kit";

const sessionHandle: Handle = async ({ event, resolve }) => {
  const sessionData = await auth.api.getSession({
    headers: event.request.headers,
  });
  event.locals.user = sessionData?.user ?? null;
  event.locals.session = sessionData?.session ?? null;
  return resolve(event);
};

const timingHandle: Handle = async ({ event, resolve }) => {
  const start =
    LOG_LEVEL === "verbose" || LOG_LEVEL === "debug"
      ? performance.now()
      : null;

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

export const handle: Handle = sequence(sessionHandle, timingHandle);
