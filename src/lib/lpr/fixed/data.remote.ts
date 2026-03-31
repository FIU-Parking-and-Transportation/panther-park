import * as v from "valibot";
import { query } from "$app/server";
import { sql, SQL } from "bun";
import { getFacilityList } from "$lib/facilities/data.remote";
import { uploadBase64Image } from "$lib/s3";

const lprReadPayloadSchema = v.object({
  Attributes: v.record(v.string(), v.string()),
  CameraName: v.pipe(v.string(), v.nonEmpty("Must have a camera name")),
  ContextImage: v.pipe(v.string(), v.base64()),
  ConfidenceScore: v.pipe(
    v.string(),
    v.toNumber("Must be a number"),
    v.minValue(0),
    v.maxValue(100),
  ),
  Latitude: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  Longitude: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  OverviewImage: v.pipe(v.string(), v.base64()),
  Plate: v.pipe(v.string(), v.nonEmpty("Must have a plate number")),
  PlateImage: v.pipe(v.string(), v.base64()),
  State: v.fallback(
    v.pipe(
      v.string(),
      v.check((val) => val.length === 2 || val.length === 0),
      v.toUpperCase(),
    ),
    "",
  ),
  VehicleID: v.pipe(v.string(), v.uuid()),
  DateUtc: v.string(), // TODO: Add date time validation
  TimeUtc: v.string(),
});

async function dummyParkingFacility(): Promise<string> {
  // TODO: Remove this facility generator shim
  const facilities = await getFacilityList();
  return facilities[Math.floor(Math.random() * facilities.length)].id;
}

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
    const id = Bun.randomUUIDv7();

    // Upload all three images to S3 in parallel, keyed under the vehicle UUID.
    const keyPrefix = `lpr/${id}`;
    let contextImageUrl: string | null = null;
    let overviewImageUrl: string | null = null;
    let plateImageUrl: string | null = null;

    try {
      [contextImageUrl, overviewImageUrl, plateImageUrl] = await Promise.all([
        uploadBase64Image(`${keyPrefix}/context.jpg`, payload.ContextImage),
        uploadBase64Image(`${keyPrefix}/overview.jpg`, payload.OverviewImage),
        uploadBase64Image(`${keyPrefix}/plate.jpg`, payload.PlateImage),
      ]);
    } catch (error: any) {
      console.error("S3 upload error:", error);
      return {
        success: false,
        error: "Failed to upload images to S3",
      };
    } // ISSUE: s3 upload and sql insert should be atomic

    try {
      const result = await sql`
        INSERT INTO lpr_read (
          id,
          attributes,
          camera_name,
          confidence_score,
          context_image,
          overview_image,
          plate_image,
          plate,
          state,
          vehicle_id,
          parking_facility_id,
          location_geog,
          read_at
        )
        VALUES (
          ${id},
          ${JSON.stringify(payload.Attributes)},
          ${payload.CameraName},
          ${payload.ConfidenceScore},
          ${contextImageUrl},
          ${overviewImageUrl},
          ${plateImageUrl},
          ${payload.Plate},
          NULLIF (${payload.State},''),
          ${payload.VehicleID},
          ${await dummyParkingFacility()},
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
