import {openapi, fromTypes } from "@elysiajs/openapi";
import { Elysia, status, t } from "elysia";
import { sql, SQL } from "bun";
import { uploadBase64Image } from "$lib/s3";
import bearer from "@elysiajs/bearer";

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

interface FacilityListItem {
  id: string;
  name: string;
  full_name: string;
}

interface FacilityLocation {
  id: string;
  name: string;
  full_name: string;
  latitude: number;
  longitude: number;
}

export interface FacilityOccupancy {
  id: string;
  name: string;
  full_name: string;
  current_occupancy: Record<string, number>;
  max_occupancy: Record<string, number>;
}

export interface DigitalSign {
  id: string;
  name: string;
  attributes: Record<string, unknown>;
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Helper – pick a random facility id 
// ---------------------------------------------------------------------------

async function randomFacilityId(): Promise<string> {
  const rows = await sql`SELECT id FROM parking_facility`;
  const list = rows as { id: string }[];
  return list[Math.floor(Math.random() * list.length)].id;
}

// ---------------------------------------------------------------------------
// Elysia app
// ---------------------------------------------------------------------------

const app = new Elysia({ prefix: "/api/v1" })
  .use(openapi({documentation: {info: { title: 'Panther Park API', version: '1.0.0'}}, references: fromTypes("src/routes/api/[...slugs]/+server.ts")}))
  .use(bearer())
  // ── GET /api/v1/facilities ────────────────────────────────────────────────
  .get(
    "/facilities",
    async () => {
      try {
        const rows = await sql`
          SELECT id, name, full_name
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
        200: t.Array(t.Object({ id: t.String(), name: t.String(), full_name: t.String() })),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "List parking facilities" },
    },
  )

  // ── GET /api/v1/facilities/locations ─────────────────────────────────────
  .get(
    "/facilities/locations",
    async () => {
      try {
        const rows = await sql`
          SELECT
            id,
            name,
            full_name,
            ST_Y(location_geog::geometry) AS latitude,
            ST_X(location_geog::geometry) AS longitude
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
            full_name: t.String(),
            latitude: t.Number(),
            longitude: t.Number(),
          }),
        ),
        404: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "List facility GeoJSON locations" },
    },
  )

  // ── GET /api/v1/facilities/occupancy ──────────────────────────────────────
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
            full_name: t.String(),
            current_occupancy: t.Record(t.String(), t.Number()),
            max_occupancy: t.Record(t.String(), t.Number()),
          }),
        ),
        404: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "Get facility occupancy" },
    },
  )

  // ── GET /api/v1/digital-signs ─────────────────────────────────────────────
  .get(
    "/digital-signs",
    async () => {
      try {
        const rows = await sql`
          SELECT
            id,
            name,
            attributes,
            ST_Y(location_geog::geometry) AS latitude,
            ST_X(location_geog::geometry) AS longitude
          FROM digital_sign
          ORDER BY name;
        `;
        return rows as DigitalSign[];
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("DB error:", error.code, error.detail);
          return status(500, { error: "Failed to fetch digital signs" });
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
            attributes: t.Record(t.String(), t.Unknown()),
            latitude: t.Number(),
            longitude: t.Number(),
          }),
        ),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "List digital signs" },
    },
  )

  // ── GET /api/v1/digital-signs/:id ────────────────────────────────────────
  .get(
    "/digital-signs/:id",
    async ({ params }) => {
      try {
        const rows = await sql`
          SELECT
            id,
            name,
            attributes,
            ST_Y(location_geog::geometry) AS latitude,
            ST_X(location_geog::geometry) AS longitude
          FROM digital_sign
          WHERE id = ${params.id}::uuid;
        `;
        if (rows.length === 0) {
          return status(404, { error: "Digital sign not found" });
        }
        return (rows as DigitalSign[])[0];
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("DB error:", error.code, error.detail);
          return status(500, { error: "Failed to fetch digital sign" });
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: {
        200: t.Object({
          id: t.String(),
          name: t.String(),
          attributes: t.Record(t.String(), t.Unknown()),
          latitude: t.Number(),
          longitude: t.Number(),
        }),
        404: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
      },
      detail: { summary: "Get a digital sign by ID" },
    },
  )

  // ── GET /api/v1/digital-signs/:id/image ──────────────────────────────────
  .get(
    "/digital-signs/:id/image",
    async ({ params }) => {
      // Fetch sign attributes from DB
      let ip: string | null = null;
      try {
        const rows = await sql`
          SELECT attributes
          FROM digital_sign
          WHERE id = ${params.id}::uuid;
        `;
        if (rows.length === 0) {
          return status(404, { error: "Digital sign not found" });
        }
        const attrs = (rows as { attributes: Record<string, unknown> }[])[0].attributes;
        if (typeof attrs.ip !== "string") {
          return status(502, { error: "Sign has no IP address configured" });
        }
        ip = attrs.ip;
      } catch (error: any) {
        if (error instanceof SQL.PostgresError) {
          console.error("DB error:", error.code, error.detail);
          return status(500, { error: "Failed to fetch digital sign" });
        }
        throw error;
      }

      // Proxy configuration from environment
      const proxyUrl = process.env.LPR_PROXY_URL;
      const proxyUsername = process.env.LPR_PROXY_USERNAME;
      const proxyPassword = process.env.LPR_PROXY_PASSWORD;
      if (!proxyUrl) {
        return status(500, { error: "Proxy not configured" });
      }

      const proxyAuth = proxyUsername && proxyPassword
        ? Buffer.from(`${proxyUsername}:${proxyPassword}`).toString("base64")
        : null;

      try {
        const imageResponse = await fetch(`http://${ip}/daktronics/imaging/1.0/GetImage`, {
          proxy: {
            url: proxyUrl,
            ...(proxyAuth ? { headers: { "Proxy-Authorization": `Basic ${proxyAuth}` } } : {}),
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!imageResponse.ok) {
          return status(502, { error: `Sign returned HTTP ${imageResponse.status}` });
        }

        const contentType = imageResponse.headers.get("content-type") ?? "image/jpeg";
        const imageBytes = await imageResponse.bytes();
        return new Response(imageBytes, {
          headers: { "Content-Type": contentType },
        });
      } catch (error: any) {
        if (error.name === "TimeoutError") {
          return status(504, { error: "Sign request timed out" });
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: {
        404: t.Object({ error: t.String() }),
        500: t.Object({ error: t.String() }),
        502: t.Object({ error: t.String() }),
        504: t.Object({ error: t.String() }),
      },
      detail: { summary: "Get a screenshot image from a digital sign" },
    },
  )

  // ── POST routes (bearer token required) ──────────────────────────────────
  .guard(
    {
      beforeHandle({ bearer, set, status }) {
        const token = process.env.DB_OPERATIONS_TOKEN;
        if (!token || bearer !== token) {
          set.headers["WWW-Authenticate"] = `Bearer realm='api', error="invalid_token"`;
          return status(401, "Unauthorized");
        }
      },
    },
    (app) => app

  // ── POST /api/v1/facilities/occupancy ─────────────────────────────────────
  .post(
    "/facilities/occupancy",
    async ({ body }) => {
      const LOG_LEVEL = process.env.LOG_LEVEL;
      if (LOG_LEVEL === "debug") console.log("DEBUG: Inserting legacy count:", body);
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

        return sql`
          UPDATE parking_facility
          SET
            current_occupancy = jsonb_set(current_occupancy, ARRAY[${countType}]::text[], to_jsonb(${count})),
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

  // ── POST /api/v1/db/operations ───────────────────────────────────────────
  .post(
    "/db/operations",
    async ({ body }) => {
      if (body.action === "seedDatabase") {
        try {
          await sql`
            SET timezone TO 'America/New_York';
            CREATE EXTENSION IF NOT EXISTS postgis;

            CREATE TABLE IF NOT EXISTS parking_facility (
              id                uuid PRIMARY KEY,
              name              text NOT NULL UNIQUE,
              full_name         text NOT NULL,
              current_occupancy jsonb NOT NULL DEFAULT '{"student": 0, "other": 0}'::jsonb,
              max_occupancy     jsonb NOT NULL DEFAULT '{"student": 0, "other": 0}'::jsonb,
              location_geog     geography(POINT, 4326) NOT NULL,
              updated_at        timestamptz NOT NULL DEFAULT now(),
              created_at        timestamptz NOT NULL DEFAULT now()
            );
            
            CREATE TABLE IF NOT EXISTS parking_occupancy_history (
              id                  uuid DEFAULT uuidv7() PRIMARY KEY,
              parking_facility_id uuid NOT NULL REFERENCES parking_facility(id) ON DELETE CASCADE,
              occupancy           jsonb NOT NULL,
              created_at          timestamptz NOT NULL DEFAULT now()
            );

            CREATE TABLE IF NOT EXISTS lpr_read (
              id                  uuid DEFAULT uuidv7() PRIMARY KEY,
              parking_facility_id uuid NOT NULL REFERENCES parking_facility(id),
              camera_name         text NOT NULL,
              confidence_score    integer,
              context_image       text,
              overview_image      text,
              plate_image         text,
              plate               text NOT NULL,
              state               text,
              vehicle_id          uuid,
              location_geog       geography(POINT, 4326),
              attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
              created_at          timestamptz NOT NULL DEFAULT now(),
              read_at             timestamptz NOT NULL DEFAULT now(),
              CONSTRAINT chk_state_len CHECK (state IS NULL OR char_length(state) = 2)
            );

            CREATE TABLE IF NOT EXISTS patroller_read (
              id                  uuid DEFAULT uuidv7() PRIMARY KEY,
              camera_name         text NOT NULL,
              confidence_score    integer,
              context_image       text,
              overview_image      text,
              plate_image         text,
              patroller_id        uuid NOT NULL,
              patroller_user_id   uuid NOT NULL,
              patroller_user_name text NOT NULL,
              plate               text NOT NULL,
              state               text,
              user_name           text NOT NULL,
              user_id             uuid NOT NULL,
              vehicle_id          uuid,
              location_geog       geography(POINT, 4326),
              attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
              created_at          timestamptz NOT NULL DEFAULT now(),
              read_at             timestamptz NOT NULL DEFAULT now(),
              CONSTRAINT chk_state_len CHECK (state IS NULL OR char_length(state) = 2)
            );

            CREATE INDEX IF NOT EXISTS lpr_read_camera_name_idx
            ON lpr_read (camera_name);
            CREATE INDEX IF NOT EXISTS lpr_read_plate_idx
            ON lpr_read (plate);
            CREATE INDEX IF NOT EXISTS lpr_read_state_idx
            ON lpr_read (state);
            CREATE INDEX IF NOT EXISTS patroller_read_patroller_user_name_idx
            ON patroller_read (patroller_user_name);
            CREATE INDEX IF NOT EXISTS lpr_read_attributes_gin
            ON lpr_read USING gin (attributes);

            CREATE OR REPLACE FUNCTION nearest_parking_facilities(
              in_lat  double precision,
              in_lon  double precision,
              in_k    integer DEFAULT 5
            )
            RETURNS TABLE (
              id           uuid,
              name         text,
              distance_m   double precision,
              bearing_deg  double precision
            )
            LANGUAGE sql
            STABLE
            AS $$
              WITH input AS (
                SELECT ST_SetSRID(ST_MakePoint(in_lon, in_lat), 4326)::geography AS geog
              ),
              shortlist AS (
                SELECT pf.id, pf.name, pf.location_geog
                FROM parking_facility pf, input i
                ORDER BY pf.location_geog <-> i.geog
                LIMIT GREATEST(in_k, 1)
              )
              SELECT
                s.id,
                s.name,
                ST_Distance(s.location_geog, i.geog) AS distance_m,
                CASE
                  WHEN degrees(ST_Azimuth(i.geog, s.location_geog)) < 0
                    THEN degrees(ST_Azimuth(i.geog, s.location_geog)) + 360
                  ELSE degrees(ST_Azimuth(i.geog, s.location_geog))
                END AS bearing_deg
              FROM shortlist s
              CROSS JOIN input i
              ORDER BY distance_m;
            $$;

            DROP MATERIALIZED VIEW IF EXISTS v_parking_facility_occupancy;
            CREATE MATERIALIZED VIEW v_parking_facility_occupancy AS
            SELECT
              pf.id   AS id,
              pf.name AS name,
              pf.full_name AS full_name,
              pf.current_occupancy,-- NOTE: using legacy counts for now 
              pf.max_occupancy 
            FROM parking_facility pf
            GROUP BY pf.id, pf.name, pf.full_name, pf.current_occupancy, pf.max_occupancy
            WITH DATA;

            CREATE TABLE IF NOT EXISTS digital_sign (
              id              uuid PRIMARY KEY,
              name            text NOT NULL UNIQUE,
              attributes      jsonb NOT NULL DEFAULT '{}'::jsonb,
              location_geog   geography(POINT, 4326) NOT NULL,
              updated_at      timestamptz NOT NULL DEFAULT now(),
              created_at      timestamptz NOT NULL DEFAULT now()
            );
          `.simple();
        } catch (error: any) {
          if (error instanceof SQL.PostgresError) {
            console.log(error.code);
            console.log(error.detail);
            console.log(error.hint);
            return status(500, { success: false, message: "Database seed failed" });
          }
          throw error;
        }
        return status(200, { success: true, message: "Database seeded successfully" });
      }

      if (body.action === "seedFacilities") {
        try {
          await sql`
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '49b82e7a-9c50-4486-a946-fe4d8093ffd9',
              'PG1',
              'PG1: Gold Garage',
              '{"student": 0, "other": 0}',
              '{"student": 576, "other": 425}',
              ST_SetSRID(ST_MakePoint(-80.372083, 25.754794), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '326db0dc-944d-4576-9346-0a935da30c63',
              'PG2',
              'PG2: Blue Garage',
              '{"student": 0, "other": 0}',
              '{"student": 616, "other": 345}',
              ST_SetSRID(ST_MakePoint(-80.372089, 25.753842), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '098db415-c8f3-478b-b652-b45e41556d39',
              'PG3',
              'PG3: Panther Garage',
              '{"student": 0, "other": 0}',
              '{"student": 1202, "other": 231}',
              ST_SetSRID(ST_MakePoint(-80.379818, 25.758427), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '9148e29e-32c3-4c49-81fa-c67db8021c5c',
              'PG4',
              'PG4: Red Garage',
              '{"student": 0, "other": 0}',
              '{"student": 995, "other": 447}',
              ST_SetSRID(ST_MakePoint(-80.373147, 25.760152), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '20b0aade-772a-49de-8364-911c59cc2703',
              'PG5',
              'PG5: Market Station',
              '{"student": 0, "other": 0}',
              '{"student": 1611, "other": 234}',
              ST_SetSRID(ST_MakePoint(-80.371652, 25.760132), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'deb719ca-6a2e-4660-9936-931be37ebb53',
              'PG6',
              'PG6: Tech Station',
              '{"student": 0, "other": 0}',
              '{"student": 1747, "other": 232}',
              ST_SetSRID(ST_MakePoint(-80.374578, 25.760147), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'd3456a65-5c3b-4155-b7d1-3968e6821e76',
              'PV',
              'Parkview',
              '{"total": 0}',
              '{"total": 293}',
              ST_SetSRID(ST_MakePoint(-80.377257, 25.754591), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '8eb591ab-26b7-4aed-9198-d3bed23a6772',
              'Lot 1',
              'Lot 1',
              '{"total": 0}',
              '{"total": 294}',
              ST_SetSRID(ST_MakePoint(-80.370383, 25.760132), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'bc8e761b-624e-4241-a4d5-7ab57712ea39',
              'Lot 3',
              'Lot 3',
              '{"total": 0}',
              '{"total": 205}',
              ST_SetSRID(ST_MakePoint(-80.370555, 25.755151), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'eb97232b-c223-4f61-bb19-5cf1db73fec8',
              'Lot 4',
              'Lot 4',
              '{"total": 0}',
              '{"total": 213}',
              ST_SetSRID(ST_MakePoint(-80.371022, 25.753721), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'ff7165da-ff04-4835-b411-2d0be172773e',
              'Lot 5',
              'Lot 5',
              '{"total": 0}',
              '{"total": 505}',
              ST_SetSRID(ST_MakePoint(-80.370663, 25.752716), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'e0c24509-cd3c-454e-b289-325455d2950d',
              'Lot 7',
              'Lot 7',
              '{"total": 0}',
              '{"total": 382}',
              ST_SetSRID(ST_MakePoint(-80.380421, 25.752813), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '73d0e63e-43a2-4bb1-98e3-325aad8b2d6d',
              'Lot 9',
              'Lot 9',
              '{"total": 0}',
              '{"total": 584}',
              ST_SetSRID(ST_MakePoint(-80.378111, 25.758499), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              'a6c13e1d-872f-4225-99fe-b8195f514fbb',
              'Lot 10',
              'Lot 10',
              '{"total": 0}',
              '{"total": 235}',
              ST_SetSRID(ST_MakePoint(-80.381231, 25.757195), 4326)::geography
            ) ON CONFLICT DO NOTHING;
            INSERT INTO parking_facility (id, name, full_name, current_occupancy, max_occupancy, location_geog)
            VALUES (
              '42de29ee-1955-419d-aca0-5ddce2028715',
              'Lot 13',
              'Lot 13',
              '{"total": 0}',
              '{"total": 77}',
              ST_SetSRID(ST_MakePoint(-80.376315, 25.755108), 4326)::geography
            ) ON CONFLICT DO NOTHING;
          `.simple();
        } catch (error: any) {
          if (error instanceof SQL.PostgresError) {
            console.log(error.code);
            console.log(error.detail);
            console.log(error.hint);
            return status(500, { success: false, message: "Garage seed failed" });
          }
          throw error;
        }
        return status(200, { success: true, message: "Facilities seeded successfully" });
      }

      if (body.action === "seedSigns") {
        try {
          await sql`
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('e840abf8-767f-439d-90ad-0aee196e4a83', '107th Ave', '{"ip": "10.104.241.15", "facilities": [ "PG1", "PG2", "PG3", "PG4", "PG5", "PG6" ]}', ST_SetSRID(ST_MakePoint(-80.3693, 25.7597), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('94e53439-562b-4b6d-96c4-fb7ca279d0ac', '108th Ave', '{"ip": "10.101.19.213", "facilities": [ "PG5", "Lot 1" ]}', ST_SetSRID(ST_MakePoint(-80.3709, 25.7597), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('006be44d-fe24-472b-aece-de90517a3243', '109th Ave', '{"ip": "10.101.20.49", "facilities": [ "PG5", "PG4" ]}', ST_SetSRID(ST_MakePoint(-80.3725, 25.7608), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('dfc9c620-b917-4c1a-801b-a0295244dfa6', '112th Ave', '{"ip": "10.101.21.21", "facilities": [ "PG6", "PG3" ]}', ST_SetSRID(ST_MakePoint(-80.3762, 25.7602), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('2cd37731-7e9e-48f2-9de0-b255a126603e', '16th St', '{"ip": "10.100.74.72", "facilities": [ "PG2", "PG1" ]}', ST_SetSRID(ST_MakePoint(-80.3707, 25.7545), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('134b5e1e-f71f-41b3-918a-8b69a364127b', 'Lot 1 North', '{"ip": "10.104.241.11", "facilities": [ "Lot 1" ]}', ST_SetSRID(ST_MakePoint(-80.3707, 25.7606), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('5ed30114-35b0-4f9c-9063-eea474344212', 'Lot 1 Traffic', '{"ip": "10.101.19.152", "facilities": [ "Lot 1" ]}', ST_SetSRID(ST_MakePoint(-80.3717, 25.7596), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('2dfeea70-0025-4787-b188-5869c80b209f', 'Lot 3 Presidents House', '{"ip": "10.100.87.111", "facilities": ["Lot 3"]}', ST_SetSRID(ST_MakePoint(-80.3700, 25.7550), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('e51f3f5d-57ce-46ad-a2f7-c267f46ae6d7', 'Lot 3 SASC', '{"ip": "10.100.87.141", "facilities": ["Lot 3"]}', ST_SetSRID(ST_MakePoint(-80.3709, 25.7563), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('1bd83594-2470-4650-8a1e-0f747d4dff50', 'Lot 5 North', '{"ip": "10.100.74.68", "facilities": ["Lot 5"]}', ST_SetSRID(ST_MakePoint(-80.3711, 25.7533), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('1498c272-b2b9-432f-b97e-d4745aef332b', 'Lot 5 South', '{"ip": "10.100.74.124", "facilities": ["Lot 5"]}', ST_SetSRID(ST_MakePoint(-80.3721, 25.7532), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('1fd130fa-20f6-4c13-b812-3f240066cd97', 'Lot 7 East', '{"ip": "10.101.146.46", "facilities": ["Lot 7"]}', ST_SetSRID(ST_MakePoint(-80.3787, 25.7533), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('71140ca3-7d00-4ba9-a221-424f3da6986f', 'Lot 7 West', '{"ip": "10.101.146.47", "facilities": ["Lot 7"]}', ST_SetSRID(ST_MakePoint(-80.3809, 25.7535), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('85f6f0d3-1f3f-4bd7-93dd-4185f105f343', 'Lot 9 Solar House', '{"ip": "10.104.241.83", "facilities": ["Lot 9", "PG3"]}', ST_SetSRID(ST_MakePoint(-80.3767, 25.7594), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('051683d8-681a-4e59-82c4-7ed7b7764be2', 'Lot 9 Traffic', '{"ip": "10.104.240.6", "facilities": ["PG3", "Lot 9"]}', ST_SetSRID(ST_MakePoint(-80.3788, 25.7580), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('c4b99c4c-b171-4342-8a59-d0452462ee87', 'Lot 9 West', '{"ip": "10.101.135.48", "facilities": ["Lot 9", "PG3"]}', ST_SetSRID(ST_MakePoint(-80.3790, 25.7589), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('d55ad231-f55b-41c3-b1ef-30f175b1d70c', 'PG3 Wall', '{"ip": "10.101.135.51", "facilities": ["PG3"]}', ST_SetSRID(ST_MakePoint(-80.3793, 25.7585), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('235d784d-40ac-498c-b73a-0a6fff3d50d3', 'PG5 Wall', '{"ip": "10.101.19.59", "facilities": ["PG5"]}', ST_SetSRID(ST_MakePoint(-80.3712, 25.7603), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('f4c3d563-c837-49f2-8915-b53937c5c622', 'PG6 East', '{"ip": "10.101.6.49", "facilities": ["PG3", "PG6"]}', ST_SetSRID(ST_MakePoint(-80.3739, 25.7598), 4326)::geography)
            ON CONFLICT DO NOTHING;
            INSERT INTO digital_sign (id, name, attributes, location_geog)
            VALUES ('de8bff49-2272-44ef-84f7-d56624e1e536', 'PG6 West', '{"ip": "10.101.6.10", "facilities": ["PG6", "PG4"]}', ST_SetSRID(ST_MakePoint(-80.3753, 25.7596), 4326)::geography)
            ON CONFLICT DO NOTHING;
          `.simple();
        } catch (error: any) {
          if (error instanceof SQL.PostgresError) {
            console.log(error.code);
            console.log(error.detail);
            console.log(error.hint);
            return status(500, { success: false, message: "Signs seed failed" });
          }
          throw error;
        }
        return status(200, { success: true, message: "Signs seeded successfully" });
      }

      return status(400, { success: false, message: "Unknown action" });
    },
    {
      body: t.Object({
        action: t.Union([t.Literal("seedDatabase"), t.Literal("seedFacilities"), t.Literal("seedSigns")]),
      }),
      response: {
        200: t.Object({ success: t.Boolean(), message: t.String() }),
        400: t.Object({ success: t.Boolean(), message: t.String() }),
        401: t.Object({ success: t.Boolean(), message: t.String() }),
        500: t.Object({ success: t.Boolean(), message: t.String() }),
      },
      detail: { summary: "Perform database operations" },
    },
  )

  // ── POST /api/v1/lpr/read ─────────────────────────────────────────────────
  .post(
    "/lpr/read",
    async ({ body }) => {
      const LOG_LEVEL = process.env.LOG_LEVEL;
      if (LOG_LEVEL === "debug") console.log("DEBUG: Inserting lpr read:", body);

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
      } catch (error: any) { console.error("S3 upload error:", error);
        return status(500, { error: "Failed to upload images to S3" });
      }

      try {
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
            ${body.ConfidenceScore},
            ${contextImageUrl},
            ${overviewImageUrl},
            ${plateImageUrl},
            ${body.Plate},
            ${state},
            ${body.VehicleID},
            ${await randomFacilityId()},
            ST_SetSRID(ST_MakePoint(${body.Longitude}, ${body.Latitude}), 4326)::geography,
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
  ));

interface WithRequest {
  request: Request;
}

export type App = typeof app;

export const fallback = ({ request }: WithRequest) => app.handle(request);
