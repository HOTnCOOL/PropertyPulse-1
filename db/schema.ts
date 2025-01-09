import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  type: text("type").notNull(), // apartment, house, shared space
  capacity: integer("capacity").notNull(),
  rate: numeric("rate").notNull(),
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
  status: text("status").notNull(), // pending, paid, refunded
  type: text("type").notNull(), // rent, deposit, service
  date: timestamp("date").notNull(),
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

// Schemas
export const insertPropertySchema = createInsertSchema(properties);
export const selectPropertySchema = createSelectSchema(properties);

export const insertGuestSchema = createInsertSchema(guests);
export const selectGuestSchema = createSelectSchema(guests);

export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);

// Types
export type Property = typeof properties.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
