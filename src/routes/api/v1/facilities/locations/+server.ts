import { json } from "@sveltejs/kit";
import { getFacilityLocation } from "$lib/facilities/data.remote";

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET(): Promise<Response> {
  try {
    const facilities = await getFacilityLocation();

    if (facilities === null) {
      return json({ error: "Location fetch error" }, { status: 404 });
    }

    return json(facilities, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching location:", error);
    return json({ error: "Failed to fetch location" }, { status: 500 });
  }
}
