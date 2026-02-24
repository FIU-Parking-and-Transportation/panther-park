import * as v from "valibot";
import { query } from "$app/server";
import { sql, SQL } from "bun";

interface FacilityOccupancy {
  id: string;
  name: string;
  occupancy: {};
  max_occupancy: {};
  updated_at: string;
}

interface FacilityLocation {
  id: string;
  name: string;
  location_geog: {
    type: string;
    coordinates: [number, number];
  };
}

interface FacilityListItem {
  id: string;
  name: string;
}

export const getFacilityList = query(async (): Promise<FacilityListItem[]> => {
  try {
    const result = await sql`
      SELECT id, name
      FROM parking_facility
      ORDER BY name;
    `;
    return result as FacilityListItem[];
  } catch (error: any) {
    if (error instanceof SQL.PostgresError) {
      console.error("Database error:", error.code, error.detail);
      return [];
    }
    console.error("Unexpected error fetching facilities:", error);
    return [];
  }
});

export const getFacilityOccupancy = query(
  v.pipe(v.string(), v.uuid()),
  async (facilityId: string): Promise<FacilityOccupancy | null> => {
    try {
      const result = await sql`
        SELECT
          id,
          name,
          occupancy,
          max_occupancy,
          updated_at
        FROM parking_facility
        WHERE id = ${facilityId}
      `;

      return result.length > 0 ? (result[0] as FacilityOccupancy) : null;
    } catch (error: any) {
      if (error instanceof SQL.PostgresError) {
        console.error("Internal SQL error:", error.code, error.detail);
        return null;
      }
      throw error;
    }
  },
);

export const getFacilityLocation = query(
  v.pipe(v.string(), v.uuid()),
  async (facilityId: string): Promise<FacilityLocation | null> => {
    try {
      const result = await sql`
        SELECT
          id,
          name,
          ST_AsGeoJSON(location_geog::geometry)::jsonb as location_geog
        FROM parking_facility
        WHERE id = ${facilityId}
      `;

      return result.length > 0 ? (result[0] as FacilityLocation) : null;
    } catch (error: any) {
      if (error instanceof SQL.PostgresError) {
        console.error("Internal SQL error:", error.code, error.detail);
        return null;
      }
      throw error;
    }
  },
);
