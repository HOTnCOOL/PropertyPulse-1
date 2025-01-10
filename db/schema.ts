import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  capacity: text("capacity").notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 0 }),
  rate: numeric("rate", { precision: 10, scale: 0 }).notNull(),
  weeklyRate: numeric("weekly_rate", { precision: 10, scale: 0 }),
  monthlyRate: numeric("monthly_rate", { precision: 10, scale: 0 }),
  isOccupied: boolean("is_occupied").default(false),
  imageUrls: jsonb("image_urls").default('[]').notNull(),
  amenities: jsonb("amenities").default('{}').notNull(),
  bedType: text("bed_type"),
  bathrooms: integer("bathrooms").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  propertyId: integer("property_id").references(() => properties.id),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id").references(() => guests.id),
  amount: numeric("amount").notNull(),
  status: text("status").notNull(), // pending, confirmed, refunded
  type: text("type").notNull(), // rent, deposit, service
  method: text("payment_method").notNull(), // cash, bank, card
  reference: text("reference"), // reference number for bank/card payments
  dueDate: timestamp("due_date").notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  confirmedBy: text("confirmed_by"), // manager who confirmed the payment
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // cash, bank
  amount: numeric("amount").notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  paymentId: integer("payment_id").references(() => payments.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const todos = pgTable("todos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const propertiesRelations = relations(properties, ({ many }) => ({
  guests: many(guests),
}));

export const guestsRelations = relations(guests, ({ one, many }) => ({
  property: one(properties, {
    fields: [guests.propertyId],
    references: [properties.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  guest: one(guests, {
    fields: [payments.guestId],
    references: [guests.id],
  }),
}));

const amenitiesSchema = z.object({
  tv: z.boolean().default(false),
  aircon: z.boolean().default(false),
  view: z.boolean().default(false),
  balcony: z.boolean().default(false),
  fireplace: z.boolean().default(false),
  sofa: z.boolean().default(false),
});

const basePropertySchema = createInsertSchema(properties);

export const insertPropertySchema = basePropertySchema.extend({
  amenities: amenitiesSchema,
  capacity: z.string().refine(
    (val) => /^\d+(\+\d+)?$/.test(val),
    "Capacity must be in format: number or number+number (e.g., '2' or '2+1')"
  ),
  hourlyRate: z.number().int().nullable(),
  rate: z.number().int(),
  weeklyRate: z.number().int().nullable(),
  monthlyRate: z.number().int().nullable(),
});

export const selectPropertySchema = createSelectSchema(properties);

export const insertGuestSchema = createInsertSchema(guests);
export const selectGuestSchema = createSelectSchema(guests);

export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);

export const insertAssetSchema = createInsertSchema(assets);
export const selectAssetSchema = createSelectSchema(assets);

export const insertTodoSchema = createInsertSchema(todos);
export const selectTodoSchema = createSelectSchema(todos);

export type Property = typeof properties.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Asset = typeof assets.$inferSelect;