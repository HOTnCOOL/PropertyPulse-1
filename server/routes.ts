import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { db } from "@db";
import bcrypt from "bcrypt";
import {
  properties,
  guests,
  payments,
  todos,
  assets,
  bookings,
  insertBookingSchema,
  admins,
  loginAdminSchema,
  loginGuestSchema
} from "@db/schema";
import { eq, and, gte, lte, or, asc, desc, sql, gt, lt } from "drizzle-orm";
import express from "express";
import { addDays, addMonths, addWeeks, differenceInDays, differenceInCalendarMonths, startOfDay } from "date-fns";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@db";

// Add custom session type
declare module 'express-session' {
  interface SessionData {
    adminId?: number;
    guestId?: number;
  }
}

// Update Multer configurations with proper types
const storage = multer.diskStorage({
  destination: (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Add these helper functions after the existing imports
function calculateNightlyRate(periodType: 'monthly' | 'weekly' | 'daily'): number {
  switch (periodType) {
    case 'monthly': return 50; // BGN per night for monthly plan
    case 'weekly': return 60;  // BGN per night for weekly plan
    case 'daily': return 70;   // BGN per night for daily plan
  }
}

function calculateDepositAmount(plan: 'monthly' | 'weekly' | 'daily', prepaidPeriodsCount: number): number {
  if (prepaidPeriodsCount >= 3) return 0; // No deposit for 3+ prepaid periods

  const baseDeposit = calculateNightlyRate(plan) * (plan === 'monthly' ? 30 : plan === 'weekly' ? 7 : 1);
  return prepaidPeriodsCount >= 2 ? baseDeposit * 0.5 : baseDeposit; // 50% off for 2+ prepaid periods
}

interface PricePeriod {
  type: 'monthly' | 'weekly' | 'daily';
  startDate: Date;
  endDate: Date;
  amount: number;
  baseRate: number;
  duration: number;
}

function calculatePricePeriods(checkIn: Date, checkOut: Date, preferredType: 'monthly' | 'weekly' | 'daily'): PricePeriod[] {
  const periods: PricePeriod[] = [];
  let currentDate = startOfDay(new Date(checkIn));
  const endDate = startOfDay(new Date(checkOut));
  const totalDays = differenceInDays(endDate, currentDate);

  const nightlyRate = calculateNightlyRate(preferredType);

  if (preferredType === 'monthly' && differenceInCalendarMonths(endDate, currentDate) >= 1) {
    // Handle monthly periods
    while (differenceInCalendarMonths(endDate, currentDate) >= 1) {
      const monthEnd = addMonths(currentDate, 1);
      const daysInMonth = differenceInDays(monthEnd, currentDate);

      periods.push({
        type: 'monthly',
        startDate: currentDate,
        endDate: monthEnd,
        amount: nightlyRate * daysInMonth,
        baseRate: nightlyRate,
        duration: daysInMonth
      });

      currentDate = monthEnd;
    }
  } else if (preferredType === 'weekly' && totalDays >= 7) {
    // Handle weekly periods
    while (differenceInDays(endDate, currentDate) >= 7) {
      const weekEnd = addWeeks(currentDate, 1);

      periods.push({
        type: 'weekly',
        startDate: currentDate,
        endDate: weekEnd,
        amount: nightlyRate * 7,
        baseRate: nightlyRate,
        duration: 7
      });

      currentDate = weekEnd;
    }
  }

  // Handle remaining days with daily rate
  const remainingDays = differenceInDays(endDate, currentDate);
  if (remainingDays > 0) {
    periods.push({
      type: 'daily',
      startDate: currentDate,
      endDate: endDate,
      amount: calculateNightlyRate('daily') * remainingDays,
      baseRate: calculateNightlyRate('daily'),
      duration: remainingDays
    });
  }

  return periods;
}

// Add this near the multer configuration
const paymentDocsStorage = multer.diskStorage({
  destination: function (_req: Express.Request, _file: Express.Multer.File, cb: multer.FileFilterCallback) {
    cb(null, path.join(process.cwd(), "uploads/payment-docs"));
  },
  filename: function (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPaymentDocs = multer({
  storage: paymentDocsStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, PDF and DOC files are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Add ID image upload configuration
const idImageStorage = multer.diskStorage({
  destination: (
    _req: Express.Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, path.join(process.cwd(), "uploads/id-images"));
  },
  filename: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'id-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadIdImage = multer({
  storage: idImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed'));
      return;
    }
    cb(null, true);
  }
});

// Fix the database queries with proper types
type QueryResult = Awaited<ReturnType<typeof db.select>>;

export function registerRoutes(app: Express): Server {
  // Set up session middleware
  const PostgresStore = connectPgSimple(session);
  app.use(
    session({
      store: new PostgresStore({
        pool: pool, // Use the imported pool
        tableName: 'session'
      }),
      secret: process.env.REPL_ID || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Authentication endpoints
  app.post("/api/auth/admin", async (req: Request, res: Response) => {
    try {
      console.log('Admin login attempt:', req.body);
      const result = loginAdminSchema.safeParse(req.body);
      if (!result.success) {
        console.log('Admin validation failed:', result.error);
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const [admin] = await db
        .select()
        .from(admins)
        .where(eq(admins.email, result.data.email))
        .limit(1);

      console.log('Admin found:', admin);

      if (!admin || !admin.id) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Use bcrypt to compare passwords
      const passwordMatch = await bcrypt.compare(result.data.password, admin.password);
      if (!passwordMatch) {
        console.log('Password does not match');
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      if (req.session) {
        req.session.adminId = admin.id;
      }
      res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/guest", async (req: Request, res: Response) => {
    try {
      console.log('Guest login attempt:', req.body);
      const result = loginGuestSchema.safeParse(req.body);
      if (!result.success) {
        console.log('Guest validation failed:', result.error);
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const booking = await db.query.bookings.findFirst({
        where: and(
          eq(bookings.bookingReference, result.data.bookingReference),
        ),
        with: {
          guest: true,
        },
      });

      console.log('Guest booking found:', booking);

      if (!booking || !booking.guest || booking.guest.email !== result.data.email) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      if (req.session) {
        req.session.guestId = booking.guest.id;
      }
      res.json({ guest: booking.guest });
    } catch (error) {
      console.error('Guest login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Properties endpoints
  app.get("/api/properties", async (_req: Request, res: Response) => {
    const allProperties = await db.query.properties.findMany();
    res.json(allProperties);
  });

  app.post("/api/properties", async (req: Request, res: Response) => {
    const property = await db.insert(properties).values(req.body).returning();
    res.json(property[0]);
  });

  app.patch("/api/properties/:id", async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.id);
    const updatedProperty = await db
      .update(properties)
      .set(req.body)
      .where(eq(properties.id, propertyId))
      .returning();

    if (!updatedProperty.length) {
      return res.status(404).send("Property not found");
    }

    res.json(updatedProperty[0]);
  });

  app.delete("/api/properties/:id", async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.id);
    const deletedProperty = await db
      .delete(properties)
      .where(eq(properties.id, propertyId))
      .returning();

    if (!deletedProperty.length) {
      return res.status(404).send("Property not found");
    }

    res.json(deletedProperty[0]);
  });

  // New endpoint for uploading property images
  app.post("/api/properties/:id/images", upload.array("images", 5), async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.id);
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).send("No files uploaded");
    }

    try {
      // Get current property
      const [property] = await db
        .select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return res.status(404).send("Property not found");
      }

      // Update property with new image URLs
      const imageUrls = files.map(file => `/uploads/${file.filename}`);
      const currentUrls = property.imageUrls as string[] || []; // Handle case where imageUrls is null

      const updatedProperty = await db
        .update(properties)
        .set({
          imageUrls: [...currentUrls, ...imageUrls]
        })
        .where(eq(properties.id, propertyId))
        .returning();

      res.json(updatedProperty[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to upload images");
    }
  });

  // New endpoint for checking property availability
  app.post("/api/properties/:id/check-availability", async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.id);
    const { checkIn, checkOut } = req.body;

    try {
      // Find any overlapping bookings
      const overlappingBookings = await db.query.guests.findFirst({
        where: and(
          eq(guests.propertyId, propertyId),
          or(
            and(
              lte(guests.checkIn, new Date(checkIn)),
              gte(guests.checkOut, new Date(checkIn))
            ),
            and(
              lte(guests.checkIn, new Date(checkOut)),
              gte(guests.checkOut, new Date(checkOut))
            ),
            and(
              gte(guests.checkIn, new Date(checkIn)),
              lte(guests.checkOut, new Date(checkOut))
            )
          )
        )
      });

      res.json({ available: !overlappingBookings });
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).send("Failed to check availability");
    }
  });

  // Guests endpoints
  app.get("/api/guests", async (_req: Request, res: Response) => {
    const allGuests = await db.query.guests.findMany({
      with: { property: true },
    });
    res.json(allGuests);
  });

  app.get("/api/guests/today", async (_req: Request, res: Response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const checkIns = await db.query.guests.findMany({
      where: and(
        gte(guests.checkIn, today),
        lte(guests.checkIn, tomorrow)
      ),
      with: { property: true },
    });

    const checkOuts = await db.query.guests.findMany({
      where: and(
        gte(guests.checkOut, today),
        lte(guests.checkOut, tomorrow)
      ),
      with: { property: true },
    });

    res.json({ checkIns, checkOuts });
  });

  app.post("/api/guests", async (req: Request, res: Response) => {
    try {
      console.log('Received guest registration request:', req.body);

      // Parse and validate dates
      const checkInDate = new Date(req.body.checkIn);
      const checkOutDate = new Date(req.body.checkOut);
      const dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null;

      // Validate dates
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        console.error('Invalid date format:', { checkIn: req.body.checkIn, checkOut: req.body.checkOut });
        return res.status(400).json({
          message: "Invalid date format for check-in or check-out dates",
          details: { checkIn: req.body.checkIn, checkOut: req.body.checkOut }
        });
      }

      if (dateOfBirth && isNaN(dateOfBirth.getTime())) {
        console.error('Invalid date of birth format:', req.body.dateOfBirth);
        return res.status(400).json({
          message: "Invalid date format for date of birth",
          details: { dateOfBirth: req.body.dateOfBirth }
        });
      }

      // Generate a unique booking reference
      const bookingReference = 'BOOK' + Math.random().toString(36).substring(2, 8).toUpperCase();

      // Start a transaction
      const result = await db.transaction(async (tx) => {
        // Create guest first
        const [guest] = await tx
          .insert(guests)
          .values({
            ...req.body,
            address: req.body.homeAddress || 'Not provided', // Map homeAddress to address
            checkIn: checkInDate,
            checkOut: checkOutDate,
            dateOfBirth: dateOfBirth,
            bookingReference,
          })
          .returning();

        console.log('Created guest:', guest);

        // Get property details
        const property = await tx.query.properties.findFirst({
          where: eq(properties.id, guest.propertyId),
        });

        if (!property) {
          throw new Error("Property not found");
        }

        // Calculate total amount using the price calculation
        const pricePeriods = calculatePricePeriods(checkInDate, checkOutDate, req.body.preferredType || 'daily'); // Added preferredType handling
        const totalAmount = pricePeriods.reduce((sum, period) => sum + period.amount, 0);

        // Create booking
        const [booking] = await tx
          .insert(bookings)
          .values({
            propertyId: guest.propertyId,
            guestId: guest.id,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            status: 'pending',
            totalAmount,
            bookingReference,
            notes: `Booking for ${guest.firstName} ${guest.lastName}`,
          })
          .returning();

        console.log('Created booking:', booking);
        return { guest, booking };
      });

      res.json(result);
    } catch (error) {
      console.error('Error creating guest:', error);
      res.status(500).json({
        message: "Failed to create guest",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/guests/:id", async (req: Request, res: Response) => {
    const guest = await db.query.guests.findFirst({
      where: eq(guests.id, parseInt(req.params.id)),
      with: { property: true },
    });
    if (!guest) return res.status(404).send("Guest not found");
    res.json(guest);
  });

  // Payments endpoints
  app.get("/api/payments", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, status, guestId } = req.query;
      let queryConditions = [];

      if (startDate && endDate) {
        queryConditions.push(
          and(
            gte(payments.date, new Date(String(startDate))),
            lte(payments.date, new Date(String(endDate)))
          )
        );
      }

      if (status) {
        queryConditions.push(eq(payments.status, String(status)));
      }

      if (guestId) {
        queryConditions.push(eq(payments.guestId, Number(guestId)));
      }

      const query = db.select().from(payments);
      if (queryConditions.length > 0) {
        query.where(and(...queryConditions));
      }

      const result = await query;
      res.json(result);
    } catch (error) {
      console.error('Error fetching payments:', error);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  app.post("/api/payments", async (req: Request, res: Response) => {
    const payment = await db.insert(payments).values({
      ...req.body,
      confirmedAt: req.body.status === 'confirmed' ? new Date() : null,
    }).returning();

    // Update assets if payment is confirmed
    if (req.body.status === 'confirmed') {
      await db.insert(assets).values({
        type: req.body.method === 'cash' ? 'cash' : 'bank',
        amount: req.body.amount,
        date: new Date(),
        description: `Payment from guest ${req.body.guestId}`,
        paymentId: payment[0].id,
      });
    }

    res.json(payment[0]);
  });

  app.patch("/api/payments/:id/confirm", async (req: Request, res: Response) => {
    const payment = await db.transaction(async (tx) => {
      // Update payment status
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: 'confirmed',
          confirmedBy: req.body.confirmedBy,
          confirmedAt: new Date(),
        })
        .where(eq(payments.id, parseInt(req.params.id)))
        .returning();

      // Add to assets
      await tx.insert(assets).values({
        type: updatedPayment.method === 'cash' ? 'cash' : 'bank',
        amount: updatedPayment.amount,
        date: new Date(),
        description: `Payment from guest ${updatedPayment.guestId}`,
        paymentId: updatedPayment.id,
      });

      return updatedPayment;
    });

    res.json(payment);
  });

  // Update payment document URLs with proper SQL array handling
  app.post("/api/payments/:id/documents", uploadPaymentDocs.array("documents", 5), async (req: Request, res: Response) => {
    const paymentId = parseInt(req.params.id);
    const files = (req.files as Express.Multer.File[]) || [];

    if (!files.length) {
      return res.status(400).send("No files uploaded");
    }

    try {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      const documentUrls = files.map(file => `/uploads/payment-docs/${file.filename}`);
      const updatedPayment = await db
        .update(payments)
        .set({
          documentUrls: documentUrls
        })
        .where(eq(payments.id, paymentId))
        .returning();

      res.json(updatedPayment[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to upload documents");
    }
  });

  // Add this new endpoint after the existing payments endpoints
  app.get("/api/payments/:id/details", async (req: Request, res: Response) => {
    try {
      const paymentId = parseInt(req.params.id);
      const payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
        with: {
          guest: {
            with: {
              property: true
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).send("Payment not found");
      }

      // Get next payment due
      const nextPayment = await db.query.payments.findFirst({
        where: and(
          eq(payments.guestId, payment.guestId),
          gt(payments.dueDate, new Date()),
          eq(payments.status, 'pending')
        ),
        orderBy: asc(payments.dueDate)
      });

      // Get payment history
      const paymentHistory = await db.query.payments.findMany({
        where: and(
          eq(payments.guestId, payment.guestId),
          lt(payments.dueDate, new Date())
        ),
        orderBy: desc(payments.dueDate),
        limit: 5
      });

      res.json({
        current: payment,
        next: nextPayment,
        history: paymentHistory
      });
    } catch (error) {
      console.error('Error fetching payment details:', error);
      res.status(500).send("Failed to fetch payment details");
    }
  });


  // Assets endpoints
  app.get("/api/assets", async (req: Request, res: Response) => {
    const { type } = req.query;
    let query = db.select().from(assets);

    if (type) {
      query = query.where(eq(assets.type, String(type)));
    }

    const allAssets = await query;
    res.json(allAssets);
  });

  // Todos endpoints
  app.get("/api/todos", async (_req: Request, res: Response) => {
    const allTodos = await db.select().from(todos);
    res.json(allTodos);
  });

  app.post("/api/todos", async (req: Request, res: Response) => {
    const todo = await db.insert(todos).values(req.body).returning();
    res.json(todo[0]);
  });

  app.patch("/api/todos/:id", async (req: Request, res: Response) => {
    const todo = await db
      .update(todos)
      .set(req.body)
      .where(eq(todos.id, parseInt(req.params.id)))
      .returning();
    res.json(todo[0]);
  });

  // Bookings endpoints
  app.post("/api/bookings", async (req: Request, res: Response) => {
    try {
      console.log('Received booking request:', req.body);

      const result = insertBookingSchema.safeParse(req.body);
      if (!result.success) {
        console.error('Validation error:', result.error);
        return res.status(400).json({
          message: "Invalid booking data",
          details: result.error.errors,
        });
      }

      // Ensure dates are properly converted to Date objects
      const checkInDate = new Date(result.data.checkIn);
      const checkOutDate = new Date(result.data.checkOut);

      // Validate dates
      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        return res.status(400).json({
          message: "Invalid date format",
        });
      }

      if (checkInDate >= checkOutDate) {
        return res.status(400).json({
          message: "Check-out date must be after check-in date",
        });
      }

      // Create the booking
      const [booking] = await db.insert(bookings)
        .values({
          propertyId: result.data.propertyId,
          guestId: result.data.guestId,
          status: result.data.status,
          totalAmount: result.data.totalAmount,
          notes: result.data.notes,
          checkIn: checkInDate,
          checkOut: checkOutDate,
        })
        .returning();

      console.log('Created booking:', booking);
      res.json(booking);
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({
        message: "Failed to create booking",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/bookings", async (req: Request, res: Response) => {
    try {
      const { propertyId, status } = req.query;
      let queryBuilder = db.select().from(bookings);

      if (propertyId) {
        queryBuilder = queryBuilder.where(
          eq(bookings.propertyId, Number(propertyId))
        );
      }

      if (status) {
        queryBuilder = queryBuilder.where(
          eq(bookings.status, String(status))
        );
      }

      const allBookings = await queryBuilder;
      res.json(allBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).send("Failed to fetch bookings");
    }
  });

  app.get("/api/properties/:id/availability", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).send("Start and end dates are required");
      }

      const startDate = new Date(String(start));
      const endDate = new Date(String(end));

      // Get all confirmed bookings for this property within the date range
      const existingBookings = await db.query.bookings.findMany({
        where: and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "confirmed"),
          or(
            and(
              lte(bookings.checkIn, startDate),
              gte(bookings.checkOut, startDate)
            ),
            and(
              lte(bookings.checkIn, endDate),
              gte(bookings.checkOut, endDate)
            ),
            and(
              gte(bookings.checkIn, startDate),
              lte(bookings.checkOut, endDate)
            )
          )
        ),
      });

      // Create an array of dates within the range
      const dates = [];
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const isBooked = existingBookings.some(booking =>
          currentDate >= new Date(booking.checkIn) && currentDate < new Date(booking.checkOut)
        );

        dates.push({
          date: currentDate.toISOString(),
          available: !isBooked,
        });

        currentDate = addDays(currentDate, 1);
      }

      res.json(dates);
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).send("Failed to check availability");
    }
  });

  app.patch("/api/bookings/:id", async (req: Request, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const [updatedBooking] = await db
        .update(bookings)
        .set(req.body)
        .where(eq(bookings.id, bookingId))
        .returning();

      if (!updatedBooking) {
        return res.status(404).send("Booking not found");
      }

      res.json(updatedBooking);
    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).send("Failed to update booking");
    }
  });

  // Update the booking query endpoint
  app.get("/api/bookings/guest", async (req: Request, res: Response) => {
    try {
      const { ref, email } = req.query;

      if (!ref || !email) {
        return res.status(400).json({ message: "Booking reference and email are required" });
      }

      // Find the booking with guest and property info
      const bookingData = await db.query.bookings.findFirst({
        where: eq(bookings.bookingReference, String(ref)),
        with: {
          guest: true,
          property: true
        }
      });

      if (!bookingData || !bookingData.guest) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (bookingData.guest.email !== email) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Get related payments
      const bookingPayments = await db.query.payments.findMany({
        where: eq(payments.guestId, bookingData.guest.id)
      });

      // Combine the data
      const fullBookingData = {
        ...bookingData,
        payments: bookingPayments
      };

      res.json(fullBookingData);
    } catch (error) {
      console.error('Error fetching guest booking:', error);
      res.status(500).json({ message: "Failed to fetch booking details" });
    }
  });

  // Add ID image upload endpoint
  app.post("/api/upload/id-image", uploadIdImage.single("idImage"), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const imageUrl = `/uploads/id-images/${req.file.filename}`;
    res.json({ url: imageUrl });
  });

  // Update the property query with proper types
  app.get("/api/properties/:id", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      const result = await db.query.properties.findFirst({
        where: sql`${properties.id} = ${propertyId}`,
      });

      if (!result) {
        return res.status(404).json({ message: 'Property not found' });
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching property:', error);
      res.status(500).json({ message: 'Failed to fetch property' });
    }
  });

  // Fix the next payment query
  app.get("/api/payments/:id/next", async (req: Request, res: Response) => {
    try {
      const guestId = parseInt(req.params.id);
      const nextPayment = await db.query.payments.findFirst({
        where: and(
          eq(payments.guestId, guestId),
          gt(payments.dueDate, new Date()),
          eq(payments.status, 'pending')
        ),
        orderBy: asc(payments.dueDate),
      });

      res.json(nextPayment);
    } catch (error) {
      console.error('Error fetching next payment:', error);
      res.status(500).json({ message: 'Failed to fetch next payment' });
    }
  });

  // Fix the payment history query
  app.get("/api/payments/:id/history", async (req: Request, res: Response) => {
    try {
      const guestId = parseInt(req.params.id);
      const paymentHistory = await db.query.payments.findMany({
        where: and(
          eq(payments.guestId, guestId),
          lt(payments.dueDate, new Date())
        ),
        orderBy: desc(payments.dueDate),
        limit: 5,
      });

      res.json(paymentHistory);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      res.status(500).json({ message: 'Failed to fetch payment history' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}