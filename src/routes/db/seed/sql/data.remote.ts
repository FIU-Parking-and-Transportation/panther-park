import { query } from "$app/server";
import { sql, SQL } from "bun";

export const seedDatabase = query(async () => {
  try {
    await sql`
      SET timezone TO 'America/New_York';
      CREATE EXTENSION IF NOT EXISTS postgis;

      CREATE TABLE IF NOT EXISTS parking_facility (
        id            uuid DEFAULT uuidv7() PRIMARY KEY,
        name          text NOT NULL UNIQUE,
        occupancy     jsonb NOT NULL DEFAULT '{"student": 0, "employee": 0}'::jsonb,
        max_occupancy jsonb NOT NULL DEFAULT '{"student": 0, "employee": 0}'::jsonb,
        location_geog       geography(POINT, 4326) NOT NULL,
        updated_at      timestamptz NOT NULL DEFAULT now(),
        created_at    timestamptz NOT NULL DEFAULT now()
      );
      
      CREATE TABLE IF NOT EXISTS parking_occupancy_history (
        id                  uuid DEFAULT uuidv7() PRIMARY KEY,
        parking_facility_id uuid NOT NULL REFERENCES parking_facility(id) ON DELETE CASCADE,
        occupancy           jsonb NOT NULL,
        created_at          timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS lpr_read (
        id                  uuid DEFAULT uuidv7() PRIMARY KEY,
        camera_name         text NOT NULL,
        confidence_score    integer,
        context_image       uuid,
        overview_image      uuid,
        plate_image         uuid,
        patroller_id        uuid,
        patroller_user_id   uuid,
        patroller_user_name text,
        plate               text NOT NULL,
        state               text,
        user_name           text,
        vehicle_id          uuid,
        location_geog       geography(POINT, 4326) NOT NULL,
        attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at          timestamptz NOT NULL DEFAULT now(),
        read_at             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT chk_state_len CHECK (state IS NULL OR char_length(state) = 2)
      ); -- Separate table for lpr hits

      CREATE INDEX IF NOT EXISTS lpr_read_vehicle_id_idx
      ON lpr_read (camera_name);
      CREATE INDEX IF NOT EXISTS lpr_read_plate_idx
      ON lpr_read (plate);
      CREATE INDEX IF NOT EXISTS lpr_read_state_idx
      ON lpr_read (state);
      CREATE INDEX IF NOT EXISTS lpr_read_patroller_user_name_idx
      ON lpr_read (patroller_user_name);
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

    `.simple();
  } catch (error: any) {
    if (error instanceof SQL.PostgresError) {
      console.log(error.code);
      console.log(error.detail);
      console.log(error.hint);
      return false;
    }
  }
  return true;
});

export const insertGarages = query(async () => {
  try {
    await sql`
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG4',
        '{"student": 1440, "faculty": 0}', -- FIXME: Add correct split count
        ST_SetSRID(ST_MakePoint(-80.373137, 25.760199), 4326)::geography
      ) ON CONFLICT DO NOTHING;

      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG5',
        '{"student": 1611, "faculty": 234}',
        ST_SetSRID(ST_MakePoint(-80.371665, 25.760223), 4326)::geography
      ) ON CONFLICT DO NOTHING;

      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG6',
        '{"student": 1747, "faculty": 232}',
        ST_SetSRID(ST_MakePoint(-80.374534, 25.760180), 4326)::geography
      ) ON CONFLICT DO NOTHING;
    `.simple();
  } catch (error: any) {
    if (error instanceof SQL.PostgresError) {
      console.log(error.code);
      console.log(error.detail);
      console.log(error.hint);
      return false;
    }
  }
  return true;
});
