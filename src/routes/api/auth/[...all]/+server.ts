import { auth } from "$lib/auth";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = ({ request }) => auth.handler(request);
export const POST: RequestHandler = ({ request }) => auth.handler(request);
