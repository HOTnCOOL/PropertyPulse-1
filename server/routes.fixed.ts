import type { Express, Request, Response, NextFunction } from "express";
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
        return res.status(400).json({ message: "Invalid date of birth format" });
      }

      // Create new guest
      const newGuest = await db.insert(guests).values({
        ...req.body,
        dateOfBirth,
        checkIn: new Date(req.body.checkIn),
        checkOut: new Date(req.body.checkOut),
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      res.status(201).json(newGuest[0]);
    } catch (error) {
      console.error('Error registering guest:', error);
      res.status(500).json({ message: "Failed to register guest" });
    }
  });

  app.patch("/api/bookings/:id", async (req: Request, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      const updatedBooking = await db
        .update(bookings)
        .set(req.body)
        .where(eq(bookings.id, bookingId))
        .returning();

      if (!updatedBooking.length) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json(updatedBooking[0]);
    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  // Create HTTP server
  const server = createServer(app);
  return server;
}