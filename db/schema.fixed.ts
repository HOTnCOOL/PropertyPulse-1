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

// Define admins table first to avoid circular references
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default('staff'),
  active: boolean("active").notNull().default(true),
  cashBalance: numeric("cash_balance", { precision: 10, scale: 2 }).default("0.00"),
  lastActivity: timestamp("last_activity"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: integer("created_by"),
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
  checkIn: timestamp("check_in"), 
  checkOut: timestamp("check_out"), 
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
  checkIn: timestamp("check_in"), 
  checkOut: timestamp("check_out"), 
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

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id").references(() => guests.id),
  bookingId: integer("booking_id").references(() => bookings.id),
  paymentId: integer("payment_id").references(() => payments.id),
  type: text("type").notNull(),
  filename: text("filename").notNull(),
  fileUrl: text("file_url").notNull(),
  originalFilename: text("original_filename"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  uploadedBy: text("uploaded_by"),
  status: text("status").notNull(),
  metadata: jsonb("metadata"),
  extractedData: jsonb("extracted_data"),
  retentionExpiry: timestamp("retention_expiry"),
  gdprConsent: boolean("gdpr_consent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  staffId: integer("staff_id").references(() => admins.id).notNull(),
  approved: boolean("approved").default(false),
  approvedBy: integer("approved_by").references(() => admins.id),
  approvedAt: timestamp("approved_at"),
  receiptDocumentId: integer("receipt_document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cashTransactions = pgTable("cash_transactions", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").references(() => admins.id).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  balanceBefore: numeric("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").references(() => admins.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow(),
  ipAddress: text("ip_address"),
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
export const adminsRelations = relations(admins, ({ one, many }) => ({
  createdByAdmin: one(admins, {
    fields: [admins.createdBy],
    references: [admins.id],
  }),
  expenses: many(expenses, { relationName: 'staffExpenses' }),
  approvedExpenses: many(expenses, { relationName: 'approvedExpenses' }),
  cashTransactions: many(cashTransactions),
  activityLogs: many(activityLogs),
}));

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

export const paymentsRelations = relations(payments, ({ one, many }) => ({
  guest: one(guests, {
    fields: [payments.guestId],
    references: [guests.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  guest: one(guests, {
    fields: [documents.guestId],
    references: [guests.id],
  }),
  booking: one(bookings, {
    fields: [documents.bookingId],
    references: [bookings.id],
  }),
  payment: one(payments, {
    fields: [documents.paymentId],
    references: [payments.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  staff: one(admins, {
    fields: [expenses.staffId],
    references: [admins.id],
  }),
  approver: one(admins, {
    fields: [expenses.approvedBy],
    references: [admins.id],
  }),
  receiptDocument: one(documents, {
    fields: [expenses.receiptDocumentId],
    references: [documents.id],
  }),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
  staff: one(admins, {
    fields: [cashTransactions.staffId],
    references: [admins.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  admin: one(admins, {
    fields: [activityLogs.adminId],
    references: [admins.id],
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
  checkIn: z.string().or(z.date()).nullish(), 
  checkOut: z.string().or(z.date()).nullish(), 
  accessCode: z.string().length(6).optional(),
  bookingReference: z.string().length(10).optional(),
  dateOfBirth: z.string().or(z.date()).optional().nullable(),
  placeOfBirth: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  homeAddress: z.string().optional(),
  idNumber: z.string().min(1, "ID/Passport number is required"),
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
  role: z.enum(['manager', 'staff', 'admin']).default('staff'),
  active: z.boolean().default(true),
  cashBalance: z.number().default(0),
  createdBy: z.number().optional(),
});

export const insertExpenseSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  date: z.coerce.date(),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  staffId: z.number(),
  receiptDocumentId: z.number().optional(),
});

export const insertCashTransactionSchema = z.object({
  staffId: z.number(),
  amount: z.number(),
  type: z.enum(['deposit', 'withdrawal', 'payment', 'expense']),
  relatedId: z.number().optional(),
  relatedType: z.string().optional(),
  balanceBefore: z.number(),
  balanceAfter: z.number(),
  notes: z.string().optional(),
  date: z.coerce.date().default(() => new Date()),
});

export const insertDocumentSchema = z.object({
  guestId: z.number().optional(),
  bookingId: z.number().optional(),
  paymentId: z.number().optional(),
  type: z.string(),
  filename: z.string(),
  fileUrl: z.string(),
  originalFilename: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
  uploadedBy: z.string().optional(),
  status: z.string().default('active'),
  metadata: z.any().optional(),
  extractedData: z.any().optional(),
});

export const loginGuestSchema = z.object({
  email: z.string().email("Invalid email address"),
  bookingReference: z.string().length(10, "Invalid booking reference"),
});

export const loginAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Define types after tables are declared
export type Property = typeof properties.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Todo = typeof todos.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Define admin roles
export type AdminRole = 'manager' | 'staff' | 'admin';

export type NewBooking = z.infer<typeof insertBookingSchema>;
export type NewAdmin = z.infer<typeof insertAdminSchema>;
export type LoginGuest = z.infer<typeof loginGuestSchema>;
export type LoginAdmin = z.infer<typeof loginAdminSchema>;