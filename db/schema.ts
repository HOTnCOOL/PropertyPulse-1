import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  capacity: integer("capacity").notNull(),
  hourlyRate: numeric("hourly_rate"),
  rate: numeric("rate").notNull(),
  weeklyRate: numeric("weekly_rate"),
  monthlyRate: numeric("monthly_rate"),
  isOccupied: boolean("is_occupied").default(false),
  imageUrl: text("image_url"),
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

// Relations
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

// Extended Schemas with Zod
const amenitiesSchema = z.object({
  tv: z.boolean().default(false),
  aircon: z.boolean().default(false),
  view: z.boolean().default(false),
  balcony: z.boolean().default(false),
  fireplace: z.boolean().default(false),
  sofa: z.boolean().default(false),
});

// Create the base insert schema
const basePropertySchema = createInsertSchema(properties);

// Extend it with the custom amenities schema
export const insertPropertySchema = basePropertySchema.extend({
  amenities: amenitiesSchema,
});

export const selectPropertySchema = createSelectSchema(properties);

export const insertGuestSchema = createInsertSchema(guests);
export const selectGuestSchema = createSelectSchema(guests);

export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);

export const insertTodoSchema = createInsertSchema(todos);
export const selectTodoSchema = createSelectSchema(todos);

// Types
export type Property = typeof properties.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Asset = typeof assets.$inferSelect;