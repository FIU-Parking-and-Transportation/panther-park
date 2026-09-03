import { treaty } from "@elysiajs/eden";
import type { App } from "elysia-api";
import type { DigitalSign } from "elysia-api";

export async function fetchSign(signId: string): Promise<DigitalSign> {
  const api = treaty<App>(window.location.origin);
  const { data, error } = await api.api.v1["digital-signs"]({ id: signId }).get();
  if (error) throw Error;
  return data as DigitalSign;
}