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

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id),
  guestId: integer("guest_id").references(() => guests.id),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  status: text("status").notNull(), // pending, confirmed, cancelled
  totalAmount: numeric("total_amount", { precision: 10, scale: 0 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  bookings: many(bookings),
}));

export const guestsRelations = relations(guests, ({ one }) => ({
  property: one(properties, {
    fields: [guests.propertyId],
    references: [properties.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  property: one(properties, {
    fields: [bookings.propertyId],
    references: [properties.id],
  }),
  guest: one(guests, {
    fields: [bookings.guestId],
    references: [guests.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  guest: one(guests, {
    fields: [payments.guestId],
    references: [guests.id],
  }),
}));


// Schemas
const amenitiesSchema = z.object({
  tv: z.boolean().default(false),
  aircon: z.boolean().default(false),
  view: z.boolean().default(false),
  balcony: z.boolean().default(false),
  fireplace: z.boolean().default(false),
  sofa: z.boolean().default(false),
});

export const insertBookingSchema = z.object({
  propertyId: z.number(),
  guestId: z.number().optional(),
  checkIn: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Invalid check-in date format"
  }),
  checkOut: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Invalid check-out date format"
  }),
  status: z.string(),
  totalAmount: z.number(),
  notes: z.string().optional(),
});

export const insertPropertySchema = createInsertSchema(properties).extend({
  amenities: amenitiesSchema,
  capacity: z.string().refine(
    (val) => /^\d+(\+\d+)?$/.test(val),
    "Capacity must be in format: number or number+number (e.g., '2' or '2+1')"
  ),
  hourlyRate: z.number().nullable(),
  rate: z.number(),
  weeklyRate: z.number().nullable(),
  monthlyRate: z.number().nullable(),
});

export const selectPropertySchema = createSelectSchema(properties);
export const insertGuestSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  propertyId: z.number(),
  checkIn: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Invalid check-in date format"
  }),
  checkOut: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Invalid check-out date format"
  }),
});
export const selectGuestSchema = createSelectSchema(guests);
export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);
export const insertAssetSchema = createInsertSchema(assets);
export const selectAssetSchema = createSelectSchema(assets);
export const insertTodoSchema = createInsertSchema(todos);
export const selectTodoSchema = createSelectSchema(todos);
export const selectBookingSchema = createSelectSchema(bookings);

// Types
export type Property = typeof properties.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = z.infer<typeof insertBookingSchema>;