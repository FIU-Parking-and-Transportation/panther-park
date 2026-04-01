import {
  pgTable,
  pgMaterializedView,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
  geometry,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Convenience alias for timestamptz columns.
const tstz = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// parking_facility
// ---------------------------------------------------------------------------
export const parkingFacility = pgTable("parking_facility", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  name: text("name").notNull().unique(),
  occupancy: jsonb("occupancy")
    .notNull()
    .$type<Record<string, number>>()
    .default({"student": 0, "other": 0}),
  maxOccupancy: jsonb("max_occupancy")
    .notNull()
    .$type<Record<string, number>>()
    .default({"student": 0, "other": 0}),
  locationGeog: geometry("location_geog", { type: "point", mode: "xy", srid: 4326 }).notNull(),
  updatedAt: tstz("updated_at")
    .notNull()
    .defaultNow(),
  createdAt: tstz("created_at")
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// parking_occupancy_history
// ---------------------------------------------------------------------------
export const parkingOccupancyHistory = pgTable("parking_occupancy_history", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  parkingFacilityId: uuid("parking_facility_id")
    .notNull()
    .references(() => parkingFacility.id, { onDelete: "cascade" }),
  occupancy: jsonb("occupancy").notNull().$type<Record<string, number>>(),
  createdAt: tstz("created_at")
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// lpr_read
// ---------------------------------------------------------------------------
export const lprRead = pgTable(
  "lpr_read",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    parkingFacilityId: uuid("parking_facility_id")
      .notNull()
      .references(() => parkingFacility.id),
    cameraName: text("camera_name").notNull(),
    confidenceScore: integer("confidence_score"),
    contextImage: text("context_image"),
    overviewImage: text("overview_image"),
    plateImage: text("plate_image"),
    plate: text("plate").notNull(),
    state: text("state"),
    vehicleId: uuid("vehicle_id"),
    locationGeog: geometry("location_geog", { type: "point", mode: "xy", srid: 4326 }),
    attributes: jsonb("attributes")
      .notNull()
      .$type<Record<string, string>>()
      .default(sql`'{}'::jsonb`),
    createdAt: tstz("created_at")
      .notNull()
      .defaultNow(),
    readAt: tstz("read_at")
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_state_len",
      sql`${table.state} IS NULL OR char_length(${table.state}) = 2`,
    ),
    index("lpr_read_camera_name_idx").on(table.cameraName),
    index("lpr_read_plate_idx").on(table.plate),
    index("lpr_read_state_idx").on(table.state),
    index("lpr_read_attributes_gin").using("gin", table.attributes),
  ],
);

// ---------------------------------------------------------------------------
// patroller_read
// ---------------------------------------------------------------------------
export const patrollerRead = pgTable(
  "patroller_read",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    cameraName: text("camera_name").notNull(),
    confidenceScore: integer("confidence_score"),
    contextImage: text("context_image"),
    overviewImage: text("overview_image"),
    plateImage: text("plate_image"),
    patrollerId: uuid("patroller_id").notNull(),
    patrollerUserId: uuid("patroller_user_id").notNull(),
    patrollerUserName: text("patroller_user_name").notNull(),
    plate: text("plate").notNull(),
    state: text("state"),
    userName: text("user_name").notNull(),
    userId: uuid("user_id").notNull(),
    vehicleId: uuid("vehicle_id"),
    locationGeog: geometry("location_geog", { type: "point", mode: "xy", srid: 4326 }),
    attributes: jsonb("attributes")
      .notNull()
      .$type<Record<string, string>>()
      .default({}),
    createdAt: tstz("created_at")
      .notNull()
      .defaultNow(),
    readAt: tstz("read_at")
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "chk_state_len",
      sql`${table.state} IS NULL OR char_length(${table.state}) = 2`,
    ),
    index("patroller_read_patroller_user_name_idx").on(table.patrollerUserName),
  ],
);

// ---------------------------------------------------------------------------
// v_parking_facility_occupancy  (materialized view)
// ---------------------------------------------------------------------------
export const vParkingFacilityOccupancy = pgMaterializedView(
  "v_parking_facility_occupancy",
  {
    id: uuid("id").notNull(),
    name: text("name").notNull(),
    occupancy: jsonb("occupancy").$type<Record<string, number>>().notNull(),
    maxOccupancy: jsonb("max_occupancy").$type<Record<string, number>>().notNull(),
  },
).as(
  sql`SELECT pf.id AS id, pf.name AS name, pf.occupancy, pf.max_occupancy FROM parking_facility pf GROUP BY pf.id, pf.name, pf.occupancy, pf.max_occupancy`,
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type ParkingFacility = typeof parkingFacility.$inferSelect;
export type NewParkingFacility = typeof parkingFacility.$inferInsert;
export type LprRead = typeof lprRead.$inferSelect;
export type NewLprRead = typeof lprRead.$inferInsert;
