import { isHttpError, json } from "@sveltejs/kit";
import { insertLprRead } from "$lib/lpr/fixed/data.remote";

/** @type {import('@sveltejs/kit').RequestHandler} */
export async function POST({
  request,
}: {
  request: Request;
}): Promise<Response> {
  try {
    const payload: unknown = await request.json();
    const result = await insertLprRead(payload as any);

    if (!result.success) {
      return json({ error: "Failed to insert LPR read" }, { status: 500 });
    }

    return json(
      {
        success: true,
        id: result.id,
        message: "LPR read successfully recorded",
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
