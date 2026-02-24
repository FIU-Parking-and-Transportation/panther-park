import * as v from "valibot";
import { query } from "$app/server";
import { sql, SQL } from "bun";

const lprReadPayloadSchema = v.object({
  Attributes: v.record(v.string(), v.string()),
  CameraName: v.string(),
  ContextImage: v.pipe(v.string(), v.base64()), // TODO: store the images in S3
  ConfidenceScore: v.pipe(
    v.string(),
    v.toNumber("Must be a number"),
    v.minValue(0),
    v.maxValue(100),
  ),
  Latitude: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  Longitude: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  OverviewImage: v.pipe(v.string(), v.base64()),
  Plate: v.string(),
  PlateImage: v.pipe(v.string(), v.base64()),
  State: v.pipe(
    v.string(),
    v.check(
      (val) => val.length === 2 || val.length === 0,
      "State must be 2 characters or empty",
    ),
    v.toUpperCase(),
  ),
  VehicleID: v.pipe(v.string(), v.uuid()),
  DateUtc: v.string(),
  TimeUtc: v.string(),
});

type LprReadPayloadOutput = v.InferOutput<typeof lprReadPayloadSchema>;

interface InsertLprReadResult {
  success: boolean;
  id?: string;
  error?: string;
}

export const insertLprRead = query(
  lprReadPayloadSchema,
  async (payload: LprReadPayloadOutput): Promise<InsertLprReadResult> => {
    const utcIso = `${payload.DateUtc} ${payload.TimeUtc} Etc/UTC`;
    console.log(utcIso);
    try {
      const result = await sql`
        INSERT INTO lpr_read (
          attributes,
          camera_name,
          confidence_score,
          plate,
          state,
          vehicle_id,
          location_geog,
          read_at
        )
        VALUES (
          ${JSON.stringify(payload.Attributes)},
          ${payload.CameraName},
          ${payload.ConfidenceScore},
          ${payload.Plate},
          ${payload.State},
          ${payload.VehicleID},
          ST_SetSRID(ST_MakePoint(${payload.Longitude}, ${payload.Latitude}), 4326)::geography,
          ${utcIso}
        )
        RETURNING id;
      `;

      if (result.length > 0 && result[0].id) {
        return {
          success: true,
          id: result[0].id as string,
        };
      }

      return {
        success: false,
        error: "Failed to insert record",
      };
    } catch (error: any) {
      if (error instanceof SQL.PostgresError) {
        console.error("Database error:", error.code, error.detail);
        return {
          success: false,
          error: `Database error: ${error.code}`,
        };
      }
      console.error("Unexpected error inserting LPR read:", error);
      return {
        success: false,
        error: "Unexpected error",
      };
    }
  },
);
