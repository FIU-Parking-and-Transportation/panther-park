import { isHttpError, json } from "@sveltejs/kit";
import { getFacilityOccupancy, insertLegacyOccupancy } from "$lib/facilities/data.remote";

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

export async function POST({
  request,
}: {
  request: Request;
}): Promise<Response> {
  try {
    const payload: unknown = await request.json();
    const result = await insertLegacyOccupancy(payload as any);

    if (!result.success) {
      return json({ error: "Failed to insert legacy occupancy" }, { status: 500 });
    }

    return json(
      {
        success: true,
        id: result.id,
        message: "Legacy occupancy successfully recorded",
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return json(
        { error: "Invalid request body: must be a JSON object" },
        { status: 400 },
      );
    }
    if (isHttpError(error)) {
      return json(
        { error: "Invalid request body: incorrect format" },
        { status: 400 },
      );
    }
    console.error("Error processing LPR read:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
