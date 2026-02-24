import * as v from "valibot";
import { json } from "@sveltejs/kit";
import { getFacilityOccupancy } from "$lib/facilities/data.remote";

const uuidSchema = v.pipe(
  v.string("must be a string"),
  v.uuid("must be a UUID"),
);

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function GET({
  params,
}: {
  params: { slug: string };
}): Promise<Response> {
  try {
    const facilityIdResult = v.safeParse(uuidSchema, params.slug);

    if (!facilityIdResult.success) {
      return json(
        {
          error: facilityIdResult.issues.map((item) => item.message),
        },
        { status: 400 },
      );
    }

    const facilityId: string = facilityIdResult.output;
    const facility = await getFacilityOccupancy(facilityId);

    if (facility === null) {
      return json({ error: "Facility not found" }, { status: 404 });
    }

    return json(facility, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching occupancy:", error);
    return json({ error: "Failed to fetch occupancy" }, { status: 500 });
  }
}
