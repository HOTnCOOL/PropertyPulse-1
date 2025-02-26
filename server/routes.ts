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
  destination: function (_req, _file, cb) {
    cb(null, path.join(process.cwd(), "uploads/payment-docs"));
  },
  filename: function (_req, file, cb) {
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

  // Add search endpoint BEFORE the :id endpoint to prevent conflicts
  app.get("/api/guests/search", async (req: Request, res: Response) => {
    try {
      const { query } = req.query;

      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.status(400).json({
          message: "Search query must be at least 2 characters long"
        });
      }

      console.log('Searching guests with query:', query);

      const searchResult = await db.query.guests.findMany({
        where: or(
          sql`LOWER(${guests.firstName}) LIKE ${`%${query.toLowerCase()}%`}`,
          sql`LOWER(${guests.lastName}) LIKE ${`%${query.toLowerCase()}%`}`,
          sql`LOWER(${guests.email}) LIKE ${`%${query.toLowerCase()}%`}`,
          sql`${guests.phone} LIKE ${`%${query}%`}`,
          sql`${guests.idNumber} LIKE ${`%${query}%`}`
        ),
        limit: 5,
        with: {
          property: true
        }
      });

      console.log('Search results:', searchResult);
      res.json(searchResult);
    } catch (error) {
      console.error('Error searching guests:', error);
      res.status(500).json({ message: "Failed to search guests" });
    }
  });

  // Then add the specific guest endpoint
  app.get("/api/guests/:id", async (req: Request, res: Response) => {
    try {
      const guestId = parseInt(req.params.id);

      // Validate the ID is a proper number
      if (isNaN(guestId)) {
        return res.status(400).json({ message: "Invalid guest ID format" });
      }

      const guest = await db.query.guests.findFirst({
        where: eq(guests.id, guestId),
        with: { property: true },
      });

      if (!guest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      res.json(guest);
    } catch (error) {
      console.error('Error fetching guest:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/guests", async (req: Request, res: Response) => {
    try {
      console.log('Received guest registration request:', req.body);

      // Parse date of birth if provided
      const dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null;

      // Validate date of birth if provided
      if (dateOfBirth && isNaN(dateOfBirth.getTime())) {
        console.error('Invalid date of birth format:', req.body.dateOfBirth);
        return res.status(400).json({
          message: "Invalid date format for date of birth",
          details: { dateOfBirth: req.body.dateOfBirth }
        });
      }

      // Ensure required fields are present
      if (!req.body.address) {
        req.body.address = "Not provided"; // Default value for address if not provided
      }

      if (!req.body.phone) {
        req.body.phone = "Not provided"; // Default value for phone if not provided
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

        // Create initial booking without dates
        const [booking] = await tx
          .insert(bookings)
          .values({
            propertyId: guest.propertyId,
            guestId: guest.id,
            status: 'pending',
            totalAmount: 0, // Will be updated when dates are selected
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
          currentDate >= booking.checkIn && currentDate < booking.checkOut
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
      console.error('Error fetching booking data:', error);
      res.status(500).json({ message: "Failed to fetch booking data" });
    }
  });

  // Add ID image upload endpoint
  app.post("/api/upload/id-image", uploadIdImage.single("idImage"), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Return the file URL
      const fileUrl = `/uploads/id-images/${file.filename}`;
      res.json({ url: fileUrl });
    } catch (error) {
      console.error('Error uploading ID image:', error);
      res.status(500).json({ message: "Failed to upload ID image" });
    }
  });
  
  // Define available OCR-capable models with fallback priority - using only the specified Google Gemini models
  const ocrModels = [
    {
      id: "google/gemini-flash-1.5:free",
      name: "Gemini Flash 1.5",
      provider: "Google"
    },
    {
      id: "google/gemini-2.0-pro-exp-02-05:free",
      name: "Gemini 2.0 Pro",
      provider: "Google"
    }
  ];
  
  // Store recent OCR requests to rotate models for repeat users
  const recentOcrRequests = new Map<string, { 
    count: number,
    lastModelIndex: number, 
    lastRequestTime: Date 
  }>();
  
  // Clear old entries from recentOcrRequests every hour
  setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [key, data] of recentOcrRequests.entries()) {
      if (data.lastRequestTime < oneHourAgo) {
        recentOcrRequests.delete(key);
      }
    }
  }, 15 * 60 * 1000); // Run every 15 minutes

  // New endpoint for ID document analysis with multiple LLM options and session-based rotation
  app.post("/api/analyze-id-documents", async (req: Request, res: Response) => {
    try {
      const { imageUrls: rawImageUrls, sessionId } = req.body;
      
      if (!rawImageUrls || !Array.isArray(rawImageUrls) || rawImageUrls.length === 0) {
        return res.status(400).json({ message: "No image URLs provided" });
      }
      
      // Additional validation - ensure all URLs are valid strings and seem to point to actual images
      const validImageUrls = rawImageUrls.filter(url => 
        typeof url === 'string' && 
        url.trim() !== '' && 
        (url.includes('uploads/id-images/') || url.startsWith('data:image/'))
      );
      
      if (validImageUrls.length === 0) {
        return res.status(400).json({ message: "No valid image URLs provided" });
      }
      
      // Determine a unique identifier for this request - either the provided sessionId, IP, or a random value
      const requestKey = sessionId || req.ip || `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      let startingModelIndex = 0;

      // Check if we've seen this session before and determine model to use
      if (recentOcrRequests.has(requestKey)) {
        const userData = recentOcrRequests.get(requestKey)!;
        userData.count += 1;
        userData.lastRequestTime = new Date();
        
        // Always rotate models on repeat requests in the same session
        // This helps in cases where a previous model might have produced poor results
        startingModelIndex = (userData.lastModelIndex + 1) % ocrModels.length;
        console.log(`Session ${requestKey} detected (request #${userData.count}), rotating from model ${userData.lastModelIndex} to ${startingModelIndex}`);
        
        // Update the session data with the new model index
        userData.lastModelIndex = startingModelIndex;
        recentOcrRequests.set(requestKey, userData);
      } else {
        // First request from this session - start with the first model
        startingModelIndex = 0;
        recentOcrRequests.set(requestKey, {
          count: 1,
          lastModelIndex: startingModelIndex,
          lastRequestTime: new Date()
        });
        console.log(`New session ${requestKey} detected, using model ${ocrModels[startingModelIndex].name}`);
      }
      
      // The prompt for OCR and document analysis
      const ocrPrompt = `You are an OCR system that extracts personal information from ID documents and passports.

## GOAL
Extract ALL text from the ID document images and create a structured output.

## FORMAT
Return EXACTLY this JSON with real values (use null for missing fields):

{
  "firstName": "John",
  "lastName": "Smith",
  "dateOfBirth": "1990-01-15",
  "placeOfBirth": "London",
  "idNumber": "AB123456",
  "personalNumber": "123456789",
  "homeAddress": "123 Main St, Anytown",
  "nationality": "British",
  "idType": "passport",
  "expiryDate": "2030-01-15"
}

## FIELD GUIDE
- firstName: First name/given name (appear after "Name:", "Given name:", etc.)
- lastName: Last name/surname (appear after "Surname:", "Family name:", etc.)
- dateOfBirth: DOB in YYYY-MM-DD format if possible (look for "Date of birth:", "DOB:", etc.)
- placeOfBirth: City or country of birth (look for "Place of birth:", "Born in:", etc.)
- idNumber: Document number (look for "Document No:", "ID number:", etc.)
- personalNumber: Personal ID number (look for "Personal No:", "PIN:", etc.)
- homeAddress: Full street address (look for "Address:", "Residence:", etc.)
- nationality: Country name (look for "Nationality:", "Citizenship:", etc.)
- idType: Either "passport" or "national_id" based on document type
- expiryDate: Expiration date in YYYY-MM-DD format (look for "Expiry date:", "Valid until:", etc.)

## CRITICAL INSTRUCTIONS
1. EXTRACT ALL visible text first, then map to appropriate fields
2. If text appears in multiple languages, use the Latin/English version
3. For missing information, use null (not empty string)
4. Return ONLY the JSON object - no explanations or other text
5. The JSON must be properly formatted
6. Read both sides of the document if visible
7. Look for hidden/watermarked text that might contain data

Do not add ANY commentary, instructions, or explanations to your response - ONLY the JSON.`;
      
      // Construct message content for multimodal LLM API
      const messageContent: Array<{type: string, text?: string, image_url?: {url: string}}> = [
        {
          type: "text",
          text: ocrPrompt
        }
      ];
      
      // Add each image to the message content
      validImageUrls.forEach((url: string) => {
        messageContent.push({
          type: "image_url",
          image_url: {
            url
          }
        });
      });
      
      // Try each model starting with the selected one, then fall back to others if needed
      let response = null;
      let currentModelIndex = startingModelIndex;
      let lastError = null;
      let attemptedModels = 0;
      
      // Track the failed model to update session data
      let failedModelIndex = -1;
      
      while (attemptedModels < ocrModels.length && !response) {
        // Make sure the model index wraps around if needed
        currentModelIndex = (startingModelIndex + attemptedModels) % ocrModels.length;
        const currentModel = ocrModels[currentModelIndex];
        console.log(`Attempting OCR with model: ${currentModel.name} (${currentModel.provider})`);
        
        try {
          // Call the LLM API through OpenRouter
          const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: currentModel.id,
              messages: [
                {
                  role: "user",
                  content: messageContent
                }
              ],
              temperature: 0.2, // Lower temperature for more factual extraction
              top_p: 1,
              repetition_penalty: 1
            })
          });
          
          if (apiResponse.ok) {
            response = apiResponse;
            console.log(`Successfully used ${currentModel.name} for OCR analysis`);
            
            // If we previously had a failure with the first model, update the session data
            // to use this successful model next time
            if (failedModelIndex !== -1 && recentOcrRequests.has(requestKey)) {
              const userData = recentOcrRequests.get(requestKey)!;
              userData.lastModelIndex = currentModelIndex;
              recentOcrRequests.set(requestKey, userData);
              console.log(`Updated session ${requestKey} to use successful model ${currentModel.name} next time`);
            }
          } else {
            // Log the error and try the next model
            const errorData = await apiResponse.json();
            lastError = {
              model: currentModel.id,
              status: apiResponse.status,
              details: errorData
            };
            console.warn(`Model ${currentModel.name} failed with status ${apiResponse.status}:`, errorData);
            
            // Record which model failed
            if (failedModelIndex === -1) {
              failedModelIndex = currentModelIndex;
            }
            
            attemptedModels++;
          }
        } catch (error) {
          console.error(`Error with model ${currentModel.name}:`, error);
          lastError = {
            model: currentModel.id,
            error: error instanceof Error ? error.message : String(error)
          };
          
          // Record which model failed
          if (failedModelIndex === -1) {
            failedModelIndex = currentModelIndex;
          }
          
          attemptedModels++;
        }
      }
      
      // If all models failed, return an error
      if (!response) {
        console.error("All OCR models failed:", lastError);
        return res.status(500).json({
          message: "All document analysis models failed",
          lastError
        });
      }
      
      // Parse the response
      const responseData = await response.json();
      
      // Log the response for debugging
      console.log("OpenRouter API Response:", JSON.stringify(responseData, null, 2));
      
      // Check if the response has the expected structure
      if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message || !responseData.choices[0].message.content) {
        console.error("Invalid response structure:", responseData);
        return res.status(500).json({ message: "Invalid response from document analysis service" });
      }
      
      const responseContent = responseData.choices[0].message.content;
      console.log("Response content:", responseContent);
      
      // Process the content - try to extract JSON or structured data
      let extractedData = {};
      try {
        // First, try to parse the entire response as JSON directly
        try {
          const parsedJson = JSON.parse(responseContent);
          console.log("Direct JSON parse successful:", parsedJson);
          
          // Map fields directly - since we've specified the exact format in the prompt
          extractedData = {
            firstName: parsedJson.firstName || null,
            lastName: parsedJson.lastName || null,
            dateOfBirth: parsedJson.dateOfBirth || null,
            placeOfBirth: parsedJson.placeOfBirth || null, 
            idNumber: parsedJson.idNumber || null,
            personalNumber: parsedJson.personalNumber || null,
            homeAddress: parsedJson.homeAddress || null,
            nationality: parsedJson.nationality || null,
            idType: parsedJson.idType || 'national_id',
            expiryDate: parsedJson.expiryDate || null
          };
          
          console.log("Extracted direct JSON data:", extractedData);
        } catch (jsonError) {
          console.log("Direct JSON parse failed, trying to extract JSON from text:", jsonError);
          
          // Try to extract JSON from the response if it's wrapped in text or markdown code blocks
          const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```|(\{[\s\S]*\})/);
          if (jsonMatch) {
            const jsonStr = (jsonMatch[1] || jsonMatch[2]).trim();
            try {
              const parsedJson = JSON.parse(jsonStr);
              console.log("Extracted JSON data:", parsedJson);
              
              // Map the parsed JSON to our expected format
              extractedData = {
                firstName: parsedJson.firstName || parsedJson.first_name || parsedJson.given_name || null,
                lastName: parsedJson.lastName || parsedJson.last_name || parsedJson.surname || null,
                dateOfBirth: parsedJson.dateOfBirth || parsedJson.date_of_birth || parsedJson.dob || null,
                placeOfBirth: parsedJson.placeOfBirth || parsedJson.place_of_birth || null,
                idNumber: parsedJson.idNumber || parsedJson.id_number || parsedJson.documentNumber || parsedJson.document_number || null,
                personalNumber: parsedJson.personalNumber || parsedJson.personal_number || null,
                homeAddress: parsedJson.homeAddress || parsedJson.home_address || parsedJson.address || null,
                nationality: parsedJson.nationality || null,
                idType: parsedJson.idType || parsedJson.id_type || parsedJson.document_type || 'national_id',
                expiryDate: parsedJson.expiryDate || parsedJson.expiry_date || parsedJson.expiration_date || null
              };
              
              console.log("Normalized extracted JSON data:", extractedData);
            } catch (nestedJsonError) {
              console.error("Failed to parse extracted JSON:", nestedJsonError);
              throw new Error("Failed to parse extracted JSON");
            }
          } else {
            // If JSON extraction fails, try to structure the data using regex
            console.log("No JSON found in response, using regex patterns");
            const nameMatches = {
              firstName: responseContent.match(/(?:Given Name|First Name|First name|Name|Given name):\s*([^\n,]+)/i),
              lastName: responseContent.match(/(?:Surname|Last Name|Last name|Family name):\s*([^\n,]+)/i)
            };
            
            const nationalityMatch = responseContent.match(/(?:Nationality|Country|Citizenship):\s*([^\n,]+)/i);
            const documentNumberMatch = responseContent.match(/(?:Document|ID|Passport|Card) (?:Number|No|#):\s*([^\n,]+)/i);
            const personalNumberMatch = responseContent.match(/(?:Personal(?:\s+Identification)?\s+Number|PIN|PIC|EGN|ЕГН|National ID):\s*([^\n,]+)/i);
            const addressMatch = responseContent.match(/(?:(?:Home|Permanent|Residential)\s+)?Address:\s*([^\n]+?)(?:$|\n)/i);
            const dobMatch = responseContent.match(/(?:Date of Birth|DOB|Birth Date|Born on):\s*([^\n,]+)/i);
            const pobMatch = responseContent.match(/(?:Place of Birth|POB|Birth Place|Born in):\s*([^\n,]+)/i);
            const expiryMatch = responseContent.match(/(?:Expiry Date|Valid Until|Expiration|Valid To|Expires):\s*([^\n,]+)/i);
            const idTypeMatch = responseContent.match(/(?:Document Type|ID Type|Card Type):\s*([^\n,]+)/i);
            
            extractedData = {
              firstName: nameMatches.firstName ? nameMatches.firstName[1].trim() : null,
              lastName: nameMatches.lastName ? nameMatches.lastName[1].trim() : null,
              nationality: nationalityMatch ? nationalityMatch[1].trim() : null,
              idNumber: documentNumberMatch ? documentNumberMatch[1].trim() : null,
              personalNumber: personalNumberMatch ? personalNumberMatch[1].trim() : null,
              homeAddress: addressMatch ? addressMatch[1].trim() : null,
              dateOfBirth: dobMatch ? dobMatch[1].trim() : null,
              placeOfBirth: pobMatch ? pobMatch[1].trim() : null,
              expiryDate: expiryMatch ? expiryMatch[1].trim() : null,
              idType: idTypeMatch ? idTypeMatch[1].trim().toLowerCase() : 'national_id'
            };
            
            console.log("Structured data from regex patterns:", extractedData);
          }
        }
      } catch (error) {
        console.error("Error parsing LLM response:", error);
        return res.status(500).json({ 
          message: "Failed to parse document data", 
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Return the successfully extracted data
      return res.json({ 
        data: extractedData,
        modelUsed: ocrModels[currentModelIndex].name,
        provider: ocrModels[currentModelIndex].provider 
      });
    } catch (error) {
      console.error("Error analyzing ID documents:", error);
      res.status(500).json({ message: "Failed to analyze ID documents" });
    }
  });

  // Add diagnostic endpoint to check OCR model status
  app.get("/api/ocr-status", async (_req: Request, res: Response) => {
    try {
      // Test each model with a simple request to check its status
      const modelStatuses = await Promise.all(ocrModels.map(async (model) => {
        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model.id,
              messages: [
                {
                  role: "user",
                  content: "Hi, are you available for OCR tasks?"
                }
              ],
              max_tokens: 10
            })
          });

          const status = response.ok ? "available" : "error";
          let details = null;
          
          if (!response.ok) {
            try {
              details = await response.json();
            } catch (e) {
              details = { error: "Could not parse response" };
            }
          }

          return {
            model: model.name,
            provider: model.provider,
            status,
            details: details,
            timestamp: new Date().toISOString()
          };
        } catch (error) {
          return {
            model: model.name,
            provider: model.provider,
            status: "unavailable",
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          };
        }
      }));

      res.json({
        timestamp: new Date().toISOString(),
        models: modelStatuses
      });
    } catch (error) {
      console.error("Error checking OCR model status:", error);
      res.status(500).json({ message: "Failed to check OCR model status" });
    }
  });

  // Add endpoint for calendar availability
  app.get("/api/calendar", async (req: Request, res: Response) => {
    try {
      const { propertyId, month, year } = req.query;

      if (!propertyId || !month || !year) {
        return res.status(400).json({ message: "Property ID, month, and year are required" });
      }

      // Convert month and year to date range
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0); // Last day of the month

      // Get all bookings for this property within the month
      const bookings = await db.query.bookings.findMany({
        where: and(
          eq(bookings.propertyId, Number(propertyId)),
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
        with: {
          guest: true
        }
      });

      // Create calendar data
      const calendar = [];
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const day = currentDate.getDate();
        const bookingsForDay = bookings.filter(booking => 
          currentDate >= booking.checkIn && currentDate < booking.checkOut
        );

        calendar.push({
          date: currentDate.toISOString(),
          day,
          booked: bookingsForDay.length > 0,
          bookings: bookingsForDay.map(booking => ({
            id: booking.id,
            guestName: booking.guest ? `${booking.guest.firstName} ${booking.guest.lastName}` : 'Unknown',
            checkIn: booking.checkIn.toISOString(),
            checkOut: booking.checkOut.toISOString()
          }))
        });

        currentDate = addDays(currentDate, 1);
      }

      res.json(calendar);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      res.status(500).json({ message: "Failed to fetch calendar data" });
    }
  });

  const server = createServer(app);

  return server;
}