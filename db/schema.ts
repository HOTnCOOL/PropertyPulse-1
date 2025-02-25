import { pgTable, text, serial, timestamp, numeric, integer, boolean, jsonb, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Add discount configuration schema for each payment plan
const discountConfigSchema = z.object({
  daily: z.object({
    type: z.enum(['progressive', 'bulkPrepay']),
    // For progressive discount
    progressiveRate: z.number().optional(), // Percentage increase per period
    progressiveMax: z.number().optional(), // Maximum discount percentage
    // For bulk prepay discount
    periodsRequired: z.number().optional(), // Number of consecutive periods required at full price
    nextPeriodDiscount: z.number().optional(), // Discount percentage on next period
  }),
  weekly: z.object({
    type: z.enum(['progressive', 'bulkPrepay']),
    progressiveRate: z.number().optional(),
    progressiveMax: z.number().optional(),
    periodsRequired: z.number().optional(),
    nextPeriodDiscount: z.number().optional(),
  }),
  monthly: z.object({
    type: z.enum(['progressive', 'bulkPrepay']),
    progressiveRate: z.number().optional(),
    progressiveMax: z.number().optional(),
    periodsRequired: z.number().optional(),
    nextPeriodDiscount: z.number().optional(),
  })
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  capacity: text("capacity").notNull(),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
  rate: numeric("rate", { precision: 10, scale: 2 }).notNull(),
  weeklyRate: numeric("weekly_rate", { precision: 10, scale: 2 }),
  monthlyRate: numeric("monthly_rate", { precision: 10, scale: 2 }),
  isOccupied: boolean("is_occupied").default(false),
  imageUrls: jsonb("image_urls").default('[]').notNull(),
  amenities: jsonb("amenities").default('{}').notNull(),
  bedType: text("bed_type"),
  bathrooms: integer("bathrooms").default(1),
  discountConfig: jsonb("discount_config").default({
    daily: {
      type: 'progressive',
      progressiveRate: 10,
      progressiveMax: 50
    },
    weekly: {
      type: 'progressive',
      progressiveRate: 10,
      progressiveMax: 50
    },
    monthly: {
      type: 'progressive',
      progressiveRate: 10,
      progressiveMax: 50
    }
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  propertyId: integer("property_id").references(() => properties.id),
  checkIn: timestamp("check_in"), // Made nullable
  checkOut: timestamp("check_out"), // Made nullable
  accessCode: varchar("access_code", { length: 6 }),
  bookingReference: varchar("booking_reference", { length: 10 }),
  dateOfBirth: timestamp("date_of_birth"),
  placeOfBirth: text("place_of_birth"),
  address: text("address").notNull(),
  homeAddress: text("home_address"),
  idNumber: text("id_number"),
  idType: text("id_type"),
  idImageUrl: text("id_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id),
  guestId: integer("guest_id").references(() => guests.id),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  status: text("status").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  bookingReference: varchar("booking_reference", { length: 10 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id").references(() => guests.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull(),
  type: text("type").notNull(),
  method: text("payment_method").notNull(),
  reference: text("reference"),
  dueDate: timestamp("due_date").notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  confirmedBy: text("confirmed_by"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
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
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  status: z.string(),
  totalAmount: z.number(),
  notes: z.string().optional(),
  bookingReference: z.string().length(10),
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
  discountConfig: discountConfigSchema,
});

export const insertGuestSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  propertyId: z.number(),
  checkIn: z.string().or(z.date()).nullish(), // Made optional and nullish
  checkOut: z.string().or(z.date()).nullish(), // Made optional and nullish
  accessCode: z.string().length(6).optional(),
  bookingReference: z.string().length(10).optional(),
  dateOfBirth: z.string().or(z.date()).optional().nullable(),
  placeOfBirth: z.string().optional(),
  homeAddress: z.string().optional(),
  address: z.string(),
  idNumber: z.string().optional(),
  idType: z.enum(['passport', 'national_id']).optional(),
  idImageUrl: z.string().optional(),
});

export const selectPropertySchema = createSelectSchema(properties).extend({
  discountConfig: discountConfigSchema,
});
export const selectGuestSchema = createSelectSchema(guests);
export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);
export const insertAssetSchema = createInsertSchema(assets);
export const selectAssetSchema = createSelectSchema(assets);
export const insertTodoSchema = createInsertSchema(todos);
export const selectTodoSchema = createSelectSchema(todos);
export const selectBookingSchema = createSelectSchema(bookings);

export const insertAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

export const loginGuestSchema = z.object({
  email: z.string().email("Invalid email address"),
  bookingReference: z.string().length(10, "Invalid booking reference"),
});

export const loginAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type Property = typeof properties.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = z.infer<typeof insertBookingSchema>;
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = z.infer<typeof insertAdminSchema>;
export type LoginGuest = z.infer<typeof loginGuestSchema>;
export type LoginAdmin = z.infer<typeof loginAdminSchema>;
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});