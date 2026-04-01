import * as v from "valibot";
import { query } from "$app/server";
import { SQL } from "bun";
import { sql, asc, ilike } from "drizzle-orm";
import { LOG_LEVEL } from "$env/static/private";
import { db } from "$lib/db";
import { parkingFacility, vParkingFacilityOccupancy } from "$lib/db/schema";

export interface FacilityOccupancy {
  id: string;
  name: string;
  occupancy: {
    [key: string]: number;
  };
  maxOccupancy: {
    [key: string]: number;
  };
  [key: string]: unknown;
}

interface FacilityLocation {
  id: string;
  name: string;
  location_geog: {x: number, y: number};
}

interface FacilityListItem {
  id: string;
  name: string;
}

export const getFacilityList = query(async (): Promise<FacilityListItem[]> => {
  try {
    const result = await db
      .select({ id: parkingFacility.id, name: parkingFacility.name })
      .from(parkingFacility)
      .orderBy(asc(parkingFacility.name));
    return result as FacilityListItem[];
  } catch (err: any) {
    if (err instanceof SQL.PostgresError) {
      console.error("Database error:", err.code, err.detail);
      return [];
    }
    console.error("Unexpected error fetching facilities:", err);
    return [];
  }
});

export const getFacilityOccupancy = query(
  async (): Promise<FacilityOccupancy[] | null> => {
    try {
      const result = await db
        .select()
        .from(vParkingFacilityOccupancy)
        .orderBy(asc(vParkingFacilityOccupancy.name));
      return result.length > 0 ? (result as FacilityOccupancy[]) : null;
    } catch (err: any) {
      if (err instanceof SQL.PostgresError) {
        console.error("Internal SQL error:", err.code, err.detail);
        return null;
      }
      throw err;
    }
  },
);

export const getFacilityLocation = query(
  async (): Promise<FacilityLocation[] | null> => {
    try {
      const result = await db
        .select({
          id: parkingFacility.id,
          name: parkingFacility.name,
          location_geog: sql<{ type: string; coordinates: [number, number] }>`
            ST_AsGeoJSON(${parkingFacility.locationGeog})::jsonb
          `.as("location_geog"),
        })
        .from(parkingFacility)
        .orderBy(asc(parkingFacility.name));
      return result.length > 0 ? (result as unknown as FacilityLocation[]) : null;
    } catch (err: any) {
      if (err instanceof SQL.PostgresError) {
        console.error("Internal SQL error:", err.code, err.detail);
        return null;
      }
      throw err;
    }
  },
);

const legacyOccupancySchema = v.object({
  Capacity: v.pipe(v.string(), v.toNumber("Must be a valid number")),
  Vehicles: v.pipe(v.string(), v.toNumber("Must be a valid number")),
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

type legacyOccupancyExportSchemaOutput = v.InferOutput<
  typeof legacyOccupancyExportSchema
>;

interface InsertLegacyOccupancyResult {
  success: boolean;
  id?: string;
  error?: string;
}

export const insertLegacyOccupancy = query(
  legacyOccupancyExportSchema,
  async (
    payload: legacyOccupancyExportSchemaOutput,
  ): Promise<InsertLegacyOccupancyResult> => {
    const promises =
      payload.OccupancyExport.ParkingOccupancies.Occupancy.map(
        async (facility) => {
          const zoneName = facility.ParkingZoneName;
          const count = facility.Vehicles;
          type countType = "student" | "other" | "total" | "";
          let name: string = "";
          let type: countType = "";
          if (zoneName.match(/PG[0-9]/)) {
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
          }
          if (LOG_LEVEL == "debug")
            console.log(
              "DEBUG: Inserting legacy count:\nzoneName:",
              zoneName,
              "name:",
              name,
              "countType:",
              type,
              "count:",
              count,
            );
          // Skip rows that didn't match a known zone pattern.
          if (!type || !name) return;
          // The path key must be a SQL literal — parameterising it produces
          // invalid syntax (ARRAY[$1]::text[]).  `type` is always one of the
          // three enum values validated above, so sql.raw() is safe here.
          return db
            .update(parkingFacility)
            .set({
            // ISSUE: unable to access jsonb object
              occupancy: sql`jsonb_set(${parkingFacility.occupancy}, ARRAY[${sql.raw(type)}]::text[], to_jsonb(${count}))`,
              updatedAt: new Date(facility.TimestampUtc),
            }) 
            .where(ilike(parkingFacility.name, name));
        },
      );

    const refreshViewPromise = db.refreshMaterializedView(vParkingFacilityOccupancy);
    await Promise.all([...promises, refreshViewPromise]);
    // TODO: return info on partial success
    return { success: true };
  },
);
