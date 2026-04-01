import { query } from "$app/server";
import { SQL } from "bun";
import { db } from "$lib/db";
import { parkingFacility } from "$lib/db/schema";

// Facility seed data.
export const insertGarages = query(async () => {
  interface GarageRow {
    name: string;
    occupancy: Record<string, number>;
    maxOccupancy: Record<string, number>;
    lng: number;
    lat: number;
  }

  const garages: GarageRow[] = [
    { name: "PG1: Gold Garage",    occupancy: { student: 0, other: 0 }, maxOccupancy: { student: 576,  other: 425 }, lng: -80.372083, lat: 25.754794 },
    { name: "PG2: Blue Garage",    occupancy: { student: 0, other: 0 }, maxOccupancy: { student: 616,  other: 345 }, lng: -80.372089, lat: 25.753842 },
    { name: "PG3: Panther Garage", occupancy: { student: 0, other: 0 }, maxOccupancy: { student: 1202, other: 231 }, lng: -80.379818, lat: 25.758427 },
    { name: "PG4: Red Garage",     occupancy: { student: 0, other: 0 }, maxOccupancy: { student: 995,  other: 447 }, lng: -80.373147, lat: 25.760152 },
    { name: "PG5: Market Station", occupancy: { student: 0, other: 0 }, maxOccupancy: { student: 1611, other: 234 }, lng: -80.371652, lat: 25.760132 },
    { name: "PG6: Tech Station",   occupancy: { student: 0, other: 0 }, maxOccupancy: { student: 1747, other: 232 }, lng: -80.374578, lat: 25.760147 },
    { name: "Parkview",  occupancy: { total: 0 }, maxOccupancy: { total: 293 }, lng: -80.377257, lat: 25.754591 },
    { name: "Lot 1",     occupancy: { total: 0 }, maxOccupancy: { total: 294 }, lng: -80.370383, lat: 25.760132 },
    { name: "Lot 3",     occupancy: { total: 0 }, maxOccupancy: { total: 205 }, lng: -80.370555, lat: 25.755151 },
    { name: "Lot 4",     occupancy: { total: 0 }, maxOccupancy: { total: 213 }, lng: -80.371022, lat: 25.753721 },
    { name: "Lot 5",     occupancy: { total: 0 }, maxOccupancy: { total: 505 }, lng: -80.370663, lat: 25.752716 },
    { name: "Lot 7",     occupancy: { total: 0 }, maxOccupancy: { total: 382 }, lng: -80.380421, lat: 25.752813 },
    { name: "Lot 9",     occupancy: { total: 0 }, maxOccupancy: { total: 584 }, lng: -80.378111, lat: 25.758499 },
    { name: "Lot 10",    occupancy: { total: 0 }, maxOccupancy: { total: 235 }, lng: -80.381231, lat: 25.757195 },
    { name: "Lot 13",    occupancy: { total: 0 }, maxOccupancy: { total: 77  }, lng: -80.376315, lat: 25.755108 },
  ];

  try {
    await Promise.all(
      garages.map((g) =>
        db
          .insert(parkingFacility)
          .values({
            name: g.name,
            occupancy: g.occupancy,
            maxOccupancy: g.maxOccupancy,
            locationGeog: { x: g.lng, y: g.lat },
          })
          .onConflictDoNothing(),
      ),
    );
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
