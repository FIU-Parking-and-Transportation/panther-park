import * as v from "valibot";
import { query } from "$app/server";
import { sql, SQL } from "bun";
import { error } from "@sveltejs/kit";
import { LOG_LEVEL } from "$env/static/private";

export interface FacilityOccupancy {
  id: string;
  name: string;
  current_occupancy: {
    [key: string]: number;
  };
  max_occupancy: {
    [key: string]: number;
  };
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
  async (): Promise<FacilityOccupancy[] | null> => {
    try {
      const result = await sql`
        SELECT * FROM v_parking_facility_occupancy
        ORDER BY name;
      `.simple();
      return result.length > 0 ? (result as FacilityOccupancy[]) : null;
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
  async (): Promise<FacilityLocation[] | null> => {
    try {
      const result = await sql`
        SELECT
          id,
          name,
          ST_AsGeoJSON(location_geog::geometry)::jsonb as location_geog
        FROM parking_facility
        ORDER BY name;
      `;
      return result.length > 0 ? (result as FacilityLocation[]) : null;
    } catch (error: any) {
      if (error instanceof SQL.PostgresError) {
        console.error("Internal SQL error:", error.code, error.detail);
        return null;
      }
      throw error;
    }
  },
);

const legacyOccupancySchema = v.object({
  Capacity: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  Vehicles:  v.pipe(v.string(), v.toNumber("Must be a valid number")),
  Violations: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  EnforcedVehicles: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  ParkingZoneId: v.pipe(v.string(), v.uuid("Must be a valid UUID")),
  ParkingZoneName: v.pipe(v.string("Must be a valid string")),
  TimestampUtc: v.pipe(v.string(), v.isoTimestamp("Must be a valid timestamp")),
});

const legacyOccupancyExportSchema = v.object({
  OccupancyExport: v.object({
    ParkingOccupancies: v.object({
      Occupancy: v.array(legacyOccupancySchema),
    }),
    RoleId: v.pipe(v.string(), v.uuid("Must be a valid UUID")),
    RoleName: v.string(),
  }),
});

type legacyOccupancyExportSchemaOutput = v.InferOutput<typeof legacyOccupancyExportSchema>;

interface InsertLegacyOccupancyResult {
  success: boolean;
  id?: string;
  error?: string;
}

export const insertLegacyOccupancy = query(
  legacyOccupancyExportSchema, async (payload: legacyOccupancyExportSchemaOutput ): Promise<InsertLegacyOccupancyResult> => {

    const promises = payload.OccupancyExport.ParkingOccupancies.Occupancy.map(async (facility) => {
      const zoneName = facility.ParkingZoneName;
      const count = facility.Capacity - facility.Vehicles;
      type countType = "student" | "other" | "total" | "";
      let name: string = "";
      let type: countType = "";
      if (zoneName.match(/PG[0-9]/)){
        if (zoneName.toLowerCase().includes("lvls 1")) {
          const m = zoneName.match(/PG[0-9]/);
          if (m) name = m[0] + "%";
          type = "other";
        } else if (zoneName.toLowerCase().includes("lvls 3")) {
          const m = zoneName.match(/PG[0-9]/);
          if (m) name = m[0] + "%";
          type = "student";
        }
      } else if (zoneName.toLowerCase().includes("lot")) {
        const m = zoneName.match(/Lot [0-9][0-9]*/);
        if (m) name = m[0];
        type = "total";
      } else {
        throw new Error('Unmatched facility name: ' + zoneName);
      }
      if (LOG_LEVEL == "debug") console.log("DEBUG: Inserting legacy count:\nzoneName:", zoneName, "name:", name, "countType:", type, "count:", count);
      const result = await sql`
        UPDATE parking_facility
        SET occupancy = jsonb_set(occupancy, ARRAY[${type}]::text[], to_jsonb(${count})),
        updated_at = ${facility.TimestampUtc}::timestamptz
        WHERE name ILIKE ${name};
        `;
      return result;
    });
    const results = await Promise.allSettled(promises);
    // TODO: return info on partial success 
    return {
      success: true,
    }
  });
