import { treaty } from "@elysiajs/eden";
import type { App } from "elysia-api";
import type { FacilityListItem } from "elysia-api";

const DECISION_CATEGORIES = ["student", "total"];
const FULL_VALUE = 10;

export async function fetchFacilities(): Promise<FacilityListItem[]> {
  const api = treaty<App>(window.location.origin);
  const { data, error } = await api.api.v1.facilities.get();
  if (error) throw Error;
  return data as FacilityListItem[];
}

export function isFull(f: FacilityListItem): boolean {
  return Object.entries(f.current_occupancy).some(
    ([key, current]) => (f.max_occupancy[key] ?? 0) > 0 && current + FULL_VALUE >= (f.max_occupancy[key] ?? 0) && DECISION_CATEGORIES.includes(key)
  );
}