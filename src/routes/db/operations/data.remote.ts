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
        occupancy     jsonb NOT NULL DEFAULT '{"student": 0, "other": 0}'::jsonb,
        max_occupancy jsonb NOT NULL DEFAULT '{"student": 0, "other": 0}'::jsonb,
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
        -- CASE
        --   /* Case 1: max_occupancy is split into student/other */
        --   WHEN pf.max_occupancy ? 'student'
        --   AND pf.max_occupancy ? 'other' THEN
        --   jsonb_build_object(
        --   'student', (COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%lvl 3%' AND lr.camera_name ILIKE '%entry%')
        --   -
        --   COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%lvl 3%' AND lr.camera_name ILIKE '%exit%')), 
        --   'other', ( COUNT(*) FILTER ( WHERE lr.camera_name ILIKE '%lvl 1%' AND lr.camera_name ILIKE '%entry%')
        --   -
        --   COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%lvl 1%' AND lr.camera_name ILIKE '%exit%')))
        --
        --   /* Case 2: max_occupancy is total only */
        --   WHEN pf.max_occupancy ? 'total' THEN
        --   jsonb_build_object('total', (COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%entry%')
        --   -
        --   COUNT(*) FILTER (WHERE lr.camera_name ILIKE '%exit%')))
        --
        --   ELSE
        --   NULL
        -- END AS occupancy
        pf.occupancy,-- NOTE: using legacy counts for now 
        pf.max_occupancy 
      --FROM parking_facility pf JOIN lpr_read lr ON lr.parking_facility_id = pf.id
      FROM parking_facility pf
      GROUP BY pf.id, pf.name, pf.occupancy, pf.max_occupancy
      WITH DATA;

      CREATE TABLE IF NOT EXISTS digital_sign (
        id              uuid DEFAULT uuidv7() PRIMARY KEY,
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
      return false;
    }
  }
  return true;
});

export const insertGarages = query(async () => {
  try {
    await sql`
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'PG1: Gold Garage',
        '{"student": 0, "other": 0}',
        '{"student": 576, "other": 425}',
        ST_SetSRID(ST_MakePoint(-80.372083, 25.754794), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'PG2: Blue Garage',
        '{"student": 0, "other": 0}',
        '{"student": 616, "other": 345}',
        ST_SetSRID(ST_MakePoint(-80.372089, 25.753842), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'PG3: Panther Garage',
        '{"student": 0, "other": 0}',
        '{"student": 1202, "other": 231}',
        ST_SetSRID(ST_MakePoint(-80.379818, 25.758427), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'PG4: Red Garage',
        '{"student": 0, "other": 0}',
        '{"student": 995, "other": 447}',
        ST_SetSRID(ST_MakePoint(-80.373147, 25.760152), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'PG5: Market Station',
        '{"student": 0, "other": 0}',
        '{"student": 1611, "other": 234}',
        ST_SetSRID(ST_MakePoint(-80.371652, 25.760132), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'PG6: Tech Station',
        '{"student": 0, "other": 0}',
        '{"student": 1747, "other": 232}',
        ST_SetSRID(ST_MakePoint(-80.374578, 25.760147), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Parkview',
        '{"total": 0}',
        '{"total": 293}',
        ST_SetSRID(ST_MakePoint(-80.377257, 25.754591), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 1',
        '{"total": 0}',
        '{"total": 294}',
        ST_SetSRID(ST_MakePoint(-80.370383, 25.760132), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 3',
        '{"total": 0}',
        '{"total": 205}',
        ST_SetSRID(ST_MakePoint(-80.370555, 25.755151), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 4',
        '{"total": 0}',
        '{"total": 213}',
        ST_SetSRID(ST_MakePoint(-80.371022, 25.753721), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 5',
        '{"total": 0}',
        '{"total": 505}',
        ST_SetSRID(ST_MakePoint(-80.370663, 25.752716), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 7',
        '{"total": 0}',
        '{"total": 382}',
        ST_SetSRID(ST_MakePoint(-80.380421, 25.752813), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 9',
        '{"total": 0}',
        '{"total": 584}',
        ST_SetSRID(ST_MakePoint(-80.378111, 25.758499), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
        'Lot 10',
        '{"total": 0}',
        '{"total": 235}',
        ST_SetSRID(ST_MakePoint(-80.381231, 25.757195), 4326)::geography
      ) ON CONFLICT DO NOTHING;
      INSERT INTO parking_facility (name, occupancy, max_occupancy, location_geog)
      VALUES (
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
      return false;
    }
  }
  return true;
});

export const insertSigns = query(async () => {
  try {
    await sql`
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('e840abf8-767f-439d-90ad-0aee196e4a83', '107th Ave', ST_SetSRID(ST_MakePoint(-80.3693, 25.7597), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('94e53439-562b-4b6d-96c4-fb7ca279d0ac', '108th Ave', ST_SetSRID(ST_MakePoint(-80.3709, 25.7597), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('006be44d-fe24-472b-aece-de90517a3243', '109th Ave', ST_SetSRID(ST_MakePoint(-80.3725, 25.7608), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('dfc9c620-b917-4c1a-801b-a0295244dfa6', '112th Ave', ST_SetSRID(ST_MakePoint(-80.3762, 25.7602), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('2cd37731-7e9e-48f2-9de0-b255a126603e', '16th St', ST_SetSRID(ST_MakePoint(-80.3707, 25.7545), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('134b5e1e-f71f-41b3-918a-8b69a364127b', 'Lot 1 North', ST_SetSRID(ST_MakePoint(-80.3707, 25.7606), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('5ed30114-35b0-4f9c-9063-eea474344212', 'Lot 1 Traffic', ST_SetSRID(ST_MakePoint(-80.3717, 25.7596), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('2dfeea70-0025-4787-b188-5869c80b209f', 'Lot 3 President''s House', ST_SetSRID(ST_MakePoint(-80.3700, 25.7550), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('e51f3f5d-57ce-46ad-a2f7-c267f46ae6d7', 'Lot 3 SASC', ST_SetSRID(ST_MakePoint(-80.3709, 25.7563), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('1bd83594-2470-4650-8a1e-0f747d4dff50', 'Lot 5 North', ST_SetSRID(ST_MakePoint(-80.3711, 25.7533), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('1498c272-b2b9-432f-b97e-d4745aef332b', 'Lot 5 South', ST_SetSRID(ST_MakePoint(-80.3721, 25.7532), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('1fd130fa-20f6-4c13-b812-3f240066cd97', 'Lot 7 East', ST_SetSRID(ST_MakePoint(-80.3787, 25.7533), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('71140ca3-7d00-4ba9-a221-424f3da6986f', 'Lot 7 West', ST_SetSRID(ST_MakePoint(-80.3809, 25.7535), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('85f6f0d3-1f3f-4bd7-93dd-4185f105f343', 'Lot 9 Solar House', ST_SetSRID(ST_MakePoint(-80.3767, 25.7594), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('051683d8-681a-4e59-82c4-7ed7b7764be2', 'Lot 9 Traffic', ST_SetSRID(ST_MakePoint(-80.3788, 25.7580), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('c4b99c4c-b171-4342-8a59-d0452462ee87', 'Lot 9 West', ST_SetSRID(ST_MakePoint(-80.3790, 25.7589), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('d55ad231-f55b-41c3-b1ef-30f175b1d70c', 'PG3 Wall', ST_SetSRID(ST_MakePoint(-80.3793, 25.7585), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('235d784d-40ac-498c-b73a-0a6fff3d50d3', 'PG5 Wall', ST_SetSRID(ST_MakePoint(-80.3712, 25.7603), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('f4c3d563-c837-49f2-8915-b53937c5c622', 'PG6 East', ST_SetSRID(ST_MakePoint(-80.3739, 25.7598), 4326)::geography)
      ON CONFLICT DO NOTHING;
      INSERT INTO digital_sign (id, name, location_geog)
      VALUES ('de8bff49-2272-44ef-84f7-d56624e1e536', 'PG6 West', ST_SetSRID(ST_MakePoint(-80.3753, 25.7596), 4326)::geography)
      ON CONFLICT DO NOTHING;
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
