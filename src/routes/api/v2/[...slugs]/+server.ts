import openapi from "@elysiajs/openapi";
import { Elysia, status, t } from "elysia";
import { sql, SQL } from "bun";
import { uploadBase64Image } from "$lib/s3";

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

interface FacilityListItem {
  id: string;
  name: string;
}

interface FacilityLocation {
  id: string;
  name: string;
  location_geog: {
    type: string;
    coordinates: [number, number];
  };
}

interface FacilityOccupancy {
  id: string;
  name: string;
  occupancy: Record<string, number>;
  max_occupancy: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helper – pick a random facility id (shim, mirrors v1 behaviour)
// ---------------------------------------------------------------------------

async function randomFacilityId(): Promise<string> {
  const rows = await sql`SELECT id FROM parking_facility`;
  const list = rows as { id: string }[];
  return list[Math.floor(Math.random() * list.length)].id;
}

// ---------------------------------------------------------------------------
// Elysia app
// ---------------------------------------------------------------------------

const app = new Elysia({ prefix: "/api/v2" })
  .use(openapi())

  // ── GET /api/v2/facilities ────────────────────────────────────────────────
  .get(
    "/facilities",
    async () => {
      try {
        const rows = await sql`
          SELECT id, name
          FROM parking_facility
          ORDER BY name;
        `;
        return rows as FacilityListItem[];
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("DB error:", error.code, error.detail);
          return status(500, { error: "Failed to fetch facilities" });
        }
        throw error;
      }
    },
    {
      response: {
        200: t.Array(t.Object({ id: t.String(), name: t.String() })),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "List parking facilities" },
    },
  )

  // ── GET /api/v2/facilities/locations ─────────────────────────────────────
  .get(
    "/facilities/locations",
    async () => {
      try {
        const rows = await sql`
          SELECT
            id,
            name,
            ST_AsGeoJSON(location_geog::geometry)::jsonb AS location_geog
          FROM parking_facility
          ORDER BY name;
        `;
        if (rows.length === 0) {
          return status(404, { error: "Location fetch error" });
        }
        return rows as FacilityLocation[];
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("DB error:", error.code, error.detail);
          return status(500, { error: "Failed to fetch locations" });
        }
        throw error;
      }
    },
    {
      response: {
        200: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            location_geog: t.Object({
              type: t.String(),
              coordinates: t.Tuple([t.Number(), t.Number()]),
            }),
          }),
        ),
        404: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "List facility GeoJSON locations" },
    },
  )

  // ── GET /api/v2/facilities/occupancy ──────────────────────────────────────
  .get(
    "/facilities/occupancy",
    async () => {
      try {
        const rows = await sql`
          SELECT * FROM v_parking_facility_occupancy
          ORDER BY name;
        `.simple();
        if (rows.length === 0) {
          return status(404, { error: "Occupancy fetch error" });
        }
        return rows as FacilityOccupancy[];
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("DB error:", error.code, error.detail);
          return status(500, { error: "Failed to fetch occupancy" });
        }
        throw error;
      }
    },
    {
      response: {
        200: t.Array(
          t.Object({
            id: t.String(),
            name: t.String(),
            occupancy: t.Record(t.String(), t.Number()),
            max_occupancy: t.Record(t.String(), t.Number()),
          }),
        ),
        404: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "Get facility occupancy" },
    },
  )

  // ── POST /api/v2/facilities/occupancy ─────────────────────────────────────
  .post(
    "/facilities/occupancy",
    async ({ body }) => {
      const LOG_LEVEL = process.env.LOG_LEVEL;
      const occupancies = body.OccupancyExport.ParkingOccupancies.Occupancy;

      const promises = occupancies.map(async (facility) => {
        const zoneName = facility.ParkingZoneName;
        const count = parseFloat(facility.Vehicles);

        type CountType = "student" | "other" | "total" | "";
        let name: string = "";
        let countType: CountType = "";

        if (zoneName.match(/PG[0-9]/)) {
          if (zoneName.toLowerCase().includes("lvls 1")) {
            const m = zoneName.match(/PG[0-9]/);
            if (m) name = m[0] + "%";
            countType = "other";
          } else if (zoneName.toLowerCase().includes("lvls 3")) {
            const m = zoneName.match(/PG[0-9]/);
            if (m) name = m[0] + "%";
            countType = "student";
          }
        } else if (zoneName.toLowerCase().includes("lot")) {
          const m = zoneName.match(/Lot [0-9][0-9]*/);
          if (m) name = m[0];
          countType = "total";
        }

        if (LOG_LEVEL === "debug") {
          console.log(
            "DEBUG: Inserting legacy count:\nzoneName:",
            zoneName,
            "name:",
            name,
            "countType:",
            countType,
            "count:",
            count,
          );
        }

        return sql`
          UPDATE parking_facility
          SET
            occupancy = jsonb_set(occupancy, ARRAY[${countType}]::text[], to_jsonb(${count})),
            updated_at = ${facility.TimestampUtc}::timestamptz
          WHERE name ILIKE ${name};
        `;
      });

      await Promise.allSettled(promises);
      await sql`REFRESH MATERIALIZED VIEW v_parking_facility_occupancy;`.simple();

      return status(201, {
        success: true,
        message: "Legacy occupancy successfully recorded",
      });
    },
    {
      body: t.Object({
        OccupancyExport: t.Object({
          ParkingOccupancies: t.Object({
            Occupancy: t.Array(
              t.Object({
                Capacity: t.String(),
                Vehicles: t.String(),
                Violations: t.String(),
                EnforcedVehicles: t.String(),
                ParkingZoneId: t.String({ format: "uuid" }),
                ParkingZoneName: t.String(),
                TimestampUtc: t.String(),
              }),
            ),
          }),
          RoleId: t.String({ format: "uuid" }),
          RoleName: t.String(),
        }),
      }),
      response: {
        201: t.Object({ success: t.Boolean(), message: t.String() }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "Insert legacy occupancy export" },
    },
  )

  // ── POST /api/v2/lpr/read ─────────────────────────────────────────────────
  .post(
    "/lpr/read",
    async ({ body }) => {
      const utcIso = `${body.DateUtc} ${body.TimeUtc} Etc/UTC`;
      const id = Bun.randomUUIDv7();
      const keyPrefix = `lpr/${id}`;

      let contextImageUrl: string;
      let overviewImageUrl: string;
      let plateImageUrl: string;

      try {
        [contextImageUrl, overviewImageUrl, plateImageUrl] = await Promise.all([
          uploadBase64Image(`${keyPrefix}/context.jpg`, body.ContextImage),
          uploadBase64Image(`${keyPrefix}/overview.jpg`, body.OverviewImage),
          uploadBase64Image(`${keyPrefix}/plate.jpg`, body.PlateImage),
        ]);
      } catch (error: any) {
        console.error("S3 upload error:", error);
        return status(500, { error: "Failed to upload images to S3" });
      }

      try {
        const confidenceScore = parseFloat(body.ConfidenceScore);
        const latitude = parseFloat(body.Latitude);
        const longitude = parseFloat(body.Longitude);
        const state =
          body.State.length === 2 ? body.State.toUpperCase() : null;

        const rows = await sql`
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
            ${JSON.stringify(body.Attributes)},
            ${body.CameraName},
            ${confidenceScore},
            ${contextImageUrl},
            ${overviewImageUrl},
            ${plateImageUrl},
            ${body.Plate},
            ${state},
            ${body.VehicleID},
            ${await randomFacilityId()},
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${utcIso}
          )
          RETURNING id;
        `;

        if (rows.length > 0 && (rows[0] as { id: string }).id) {
          return status(201, {
            success: true,
            id: (rows[0] as { id: string }).id,
            message: "LPR read successfully recorded",
          });
        }

        return status(500, { error: "Failed to insert record" });
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("Database error:", error.code, error.detail);
          return status(500, { error: `Database error: ${error.code}` });
        }
        console.error("Unexpected error inserting LPR read:", error);
        return status(500, { error: "Unexpected error" });
      }
    },
    {
      body: t.Object({
        Attributes: t.Record(t.String(), t.String()),
        CameraName: t.String({ minLength: 1 }),
        ContextImage: t.String(),
        ConfidenceScore: t.String(),
        Latitude: t.String(),
        Longitude: t.String(),
        OverviewImage: t.String(),
        Plate: t.String({ minLength: 1 }),
        PlateImage: t.String(),
        State: t.String(),
        VehicleID: t.String({ format: "uuid" }),
        DateUtc: t.String(),
        TimeUtc: t.String(),
      }),
      response: {
        201: t.Object({
          success: t.Boolean(),
          id: t.Optional(t.String()),
          message: t.String(),
        }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "Insert fixed-camera LPR plate read" },
    },
  );

interface WithRequest {
  request: Request;
}

export const fallback = ({ request }: WithRequest) => app.handle(request);
