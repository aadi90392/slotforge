import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expires: integer("expires").notNull(),
});
export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  inviteCode: text("invite_code").notNull().unique(),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
});
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(),
  },
  (t) => [uniqueIndex("membership_unique").on(t.workspaceId, t.userId)],
);
export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  capacity: integer("capacity").notNull(),
  image: text("image").notNull(),
  location: text("location").notNull(),
  amenities: text("amenities").notNull(),
  active: integer("active").notNull().default(1),
});
export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    day: text("day").notNull(),
    hour: integer("hour").notNull(),
    status: text("status").notNull(),
    holdUntil: integer("hold_until"),
    key: text("idempotency_key").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    updatedBy: text("updated_by").notNull(),
  },
  (t) => [
    uniqueIndex("active_slot_unique")
      .on(t.resourceId, t.day, t.hour)
      .where(sql`${t.status} IN ('held','confirmed')`),
    uniqueIndex("booking_request_unique").on(t.workspaceId, t.userId, t.key),
    index("booking_workspace_date").on(t.workspaceId, t.day),
  ],
);
export const audits = sqliteTable("audits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: text("workspace_id").notNull(),
  bookingId: text("booking_id").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  detail: text("detail").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const limits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expires: integer("expires").notNull(),
});
