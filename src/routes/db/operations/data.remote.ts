import { query } from "$app/server";
import { sql, SQL } from "bun";

export const SEED_DATABASE = query(async () => {
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

      CREATE INDEX IF NOT EXISTS lpr_read_vehicle_id_idx
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

      CREATE OR REPLACE VIEW v_parking_facility_occupancy AS
      SELECT
        pf.id   AS id,
        pf.name AS name,
        pf.max_occupancy,

        CASE
          /* Case 1: max_occupancy is split into student/employee */
          WHEN pf.max_occupancy ? 'student'
          AND pf.max_occupancy ? 'employee' THEN
          jsonb_build_object(
          'student', (COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%lvl 3%' AND lr.camera_name ILIKE '%entry%')
          -
          COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%lvl 3%' AND lr.camera_name ILIKE '%exit%')), 
          'employee', ( COUNT(*) FILTER ( WHERE lr.camera_name ILIKE '%lvl 1%' AND lr.camera_name ILIKE '%entry%')
          -
          COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%lvl 1%' AND lr.camera_name ILIKE '%exit%')))

          /* Case 2: max_occupancy is total only */
          WHEN pf.max_occupancy ? 'total' THEN
          jsonb_build_object('total', (COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%entry%')
          -
          COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%exit%')))

          ELSE
          NULL
        END AS current_occupancy

      FROM parking_facility pf JOIN lpr_read lr ON lr.parking_facility_id = pf.id
      GROUP BY pf.id, pf.name, pf.max_occupancy;
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
        'PG1',
        '{"student": 576, "employee": 425}',
        ST_SetSRID(ST_MakePoint(-80.372083, 25.754794), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG2',
        '{"student": 616, "employee": 345}',
        ST_SetSRID(ST_MakePoint(-80.372089, 25.753842), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG3',
        '{"student": 1202, "employee": 231}',
        ST_SetSRID(ST_MakePoint(-80.379818, 25.758427), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG4',
        '{"student": 995, "employee": 447}',
        ST_SetSRID(ST_MakePoint(-80.373147, 25.760152), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG5',
        '{"student": 1611, "employee": 234}',
        ST_SetSRID(ST_MakePoint(-80.371652, 25.760132), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'PG6',
        '{"student": 1747, "employee": 232}',
        ST_SetSRID(ST_MakePoint(-80.374578, 25.760147), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Parkview',
        '{"total": 293}',
        ST_SetSRID(ST_MakePoint(-80.377257, 25.754591), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 1',
        '{"total": 294}',
        ST_SetSRID(ST_MakePoint(-80.370383, 25.760132), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 3',
        '{"total": 205}',
        ST_SetSRID(ST_MakePoint(-80.370555, 25.755151), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 4',
        '{"total": 213}',
        ST_SetSRID(ST_MakePoint(-80.371022, 25.753721), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 5',
        '{"total": 505}',
        ST_SetSRID(ST_MakePoint(-80.370663, 25.752716), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 7',
        '{"total": 382}',
        ST_SetSRID(ST_MakePoint(-80.380421, 25.752813), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 9',
        '{"total": 584}',
        ST_SetSRID(ST_MakePoint(-80.378111, 25.758499), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 10',
        '{"total": 235}',
        ST_SetSRID(ST_MakePoint(-80.381231, 25.757195), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, max_occupancy, location_geog)
      VALUES (
        'Lot 13',
        '{"total": 77}',
        ST_SetSRID(ST_MakePoint(-80.376315, 25.755108), 4326)::geography
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
