import { json } from "@sveltejs/kit";
import { getFacilityOccupancy } from "$lib/facilities/data.remote";

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET(): Promise<Response> {
  try {
    const facilities = await getFacilityOccupancy();

    if (facilities === null) {
      return json({ error: "Occupancy fetch error" }, { status: 404 });
    }

    return json(facilities, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching occupancy:", error);
    return json({ error: "Failed to fetch occupancy" }, { status: 500 });
  }
}
