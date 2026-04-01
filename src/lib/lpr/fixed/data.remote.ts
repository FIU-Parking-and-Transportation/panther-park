import * as v from "valibot";
import { query } from "$app/server";
import { SQL } from "bun";
import { sql } from "drizzle-orm";
import { getFacilityList } from "$lib/facilities/data.remote";
import { uploadBase64Image } from "$lib/s3";
import { db } from "$lib/db";
import { lprRead } from "$lib/db/schema";

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

function normalizeDate (date: string, time: string) {
  const input = `${date} ${time} Etc/UTC`;
  const [datePart, timePart] = input.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  const ts = new Date(Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  ));
  return ts;
}

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
      const facilityId = await dummyParkingFacility();
      const rows = await db
        .insert(lprRead)
        .values({
          id: id,
          attributes: payload.Attributes,
          cameraName: payload.CameraName,
          confidenceScore: payload.ConfidenceScore,
          contextImage: contextImageUrl,
          overviewImage: overviewImageUrl,
          plateImage: plateImageUrl,
          plate: payload.Plate,
          state: sql`NULLIF(${payload.State}, '')`,
          vehicleId: payload.VehicleID,
          parkingFacilityId: facilityId,
          locationGeog: {x: payload.Longitude, y: payload.Latitude},
          readAt: normalizeDate(payload.DateUtc, payload.TimeUtc),
        })
        .returning({ id: lprRead.id });

      if (rows.length > 0 && rows[0].id) {
        return {
          success: true,
          id: rows[0].id,
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
