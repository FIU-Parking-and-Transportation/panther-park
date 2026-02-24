import { getFacilityList } from "$lib/facilities/data.remote";
import { json } from "@sveltejs/kit";

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET() {
  try {
    const facilities = await getFacilityList();
    return json(facilities, { status: 200 });
  } catch (error) {
    console.error("Error fetching facilities:", error);
    return json({ error: "Failed to fetch facilities" }, { status: 500 });
  }
}
