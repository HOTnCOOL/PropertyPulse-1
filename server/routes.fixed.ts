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

// Create Multer uploader for ID images
const idStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "uploads/id-images"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `id-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Create Multer uploader for payment documents
const paymentDocStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "uploads/payment-docs"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `payment-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });
const uploadId = multer({ storage: idStorage });
const uploadPaymentDocs = multer({ storage: paymentDocStorage });

function calculateNightlyRate(periodType: 'monthly' | 'weekly' | 'daily'): number {
  const baseMonthlyRate = 1200; // $1200 per month
  const baseWeeklyRate = 350;  // $350 per week
  const baseDailyRate = 60;    // $60 per day

  switch (periodType) {
    case 'monthly':
      return baseMonthlyRate / 30; // Average nightly rate for monthly stays
    case 'weekly':
      return baseWeeklyRate / 7; // Average nightly rate for weekly stays
    case 'daily':
      return baseDailyRate; // Nightly rate for daily stays
    default:
      return baseDailyRate; // Default to daily rate
  }
}

function calculateDepositAmount(plan: 'monthly' | 'weekly' | 'daily', prepaidPeriodsCount: number): number {
  // Base deposit percentages for different plans
  const depositPercentages = {
    monthly: 25, // 25% of the first month's rent
    weekly: 25,  // 25% of the first week's rent
    daily: 50    // 50% of the daily rate for short stays
  };

  const baseDepositPercentage = depositPercentages[plan];
  
  // Calculate deposit based on the plan rate and percentage
  let depositAmount = 0;
  switch (plan) {
    case 'monthly':
      depositAmount = (1200 * baseDepositPercentage / 100) * prepaidPeriodsCount;
      break;
    case 'weekly':
      depositAmount = (350 * baseDepositPercentage / 100) * prepaidPeriodsCount;
      break;
    case 'daily':
      depositAmount = (60 * baseDepositPercentage / 100) * prepaidPeriodsCount;
      break;
  }

  return depositAmount;
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
  const nights = differenceInDays(checkOut, checkIn);
  const periods: PricePeriod[] = [];
  
  let currentDate = new Date(checkIn);
  
  // Calculate monthly, weekly, and daily rates per night
  const monthlyNightlyRate = calculateNightlyRate('monthly');
  const weeklyNightlyRate = calculateNightlyRate('weekly');
  const dailyNightlyRate = calculateNightlyRate('daily');
  
  // Process the stay based on preferred type
  switch (preferredType) {
    case 'monthly':
      // If stay is at least 28 days, use monthly rate
      if (nights >= 28) {
        const fullMonths = Math.floor(differenceInCalendarMonths(checkOut, checkIn));
        let remainingEndDate = checkOut;
        
        // Handle full months
        if (fullMonths > 0) {
          const fullMonthEndDate = addMonths(currentDate, fullMonths);
          periods.push({
            type: 'monthly',
            startDate: new Date(currentDate),
            endDate: new Date(fullMonthEndDate),
            amount: 1200 * fullMonths, // $1200 per month
            baseRate: 1200,
            duration: fullMonths
          });
          currentDate = new Date(fullMonthEndDate);
        }
        
        // Handle remaining days
        const remainingDays = differenceInDays(remainingEndDate, currentDate);
        if (remainingDays > 0) {
          if (remainingDays >= 7) {
            const fullWeeks = Math.floor(remainingDays / 7);
            const weeklyEndDate = addWeeks(currentDate, fullWeeks);
            
            periods.push({
              type: 'weekly',
              startDate: new Date(currentDate),
              endDate: new Date(weeklyEndDate),
              amount: 350 * fullWeeks, // $350 per week
              baseRate: 350,
              duration: fullWeeks
            });
            
            currentDate = new Date(weeklyEndDate);
            const finalDays = differenceInDays(remainingEndDate, currentDate);
            
            if (finalDays > 0) {
              periods.push({
                type: 'daily',
                startDate: new Date(currentDate),
                endDate: new Date(remainingEndDate),
                amount: dailyNightlyRate * finalDays,
                baseRate: dailyNightlyRate,
                duration: finalDays
              });
            }
          } else {
            // Less than a week remaining
            periods.push({
              type: 'daily',
              startDate: new Date(currentDate),
              endDate: new Date(remainingEndDate),
              amount: dailyNightlyRate * remainingDays,
              baseRate: dailyNightlyRate,
              duration: remainingDays
            });
          }
        }
      } else if (nights >= 7) {
        // Less than a month but more than a week
        const fullWeeks = Math.floor(nights / 7);
        const weeklyEndDate = addWeeks(currentDate, fullWeeks);
        
        periods.push({
          type: 'weekly',
          startDate: new Date(currentDate),
          endDate: new Date(weeklyEndDate),
          amount: 350 * fullWeeks,
          baseRate: 350,
          duration: fullWeeks
        });
        
        currentDate = new Date(weeklyEndDate);
        const remainingDays = differenceInDays(checkOut, currentDate);
        
        if (remainingDays > 0) {
          periods.push({
            type: 'daily',
            startDate: new Date(currentDate),
            endDate: new Date(checkOut),
            amount: dailyNightlyRate * remainingDays,
            baseRate: dailyNightlyRate,
            duration: remainingDays
          });
        }
      } else {
        // Less than a week
        periods.push({
          type: 'daily',
          startDate: new Date(checkIn),
          endDate: new Date(checkOut),
          amount: dailyNightlyRate * nights,
          baseRate: dailyNightlyRate,
          duration: nights
        });
      }
      break;
      
    case 'weekly':
      // Use weekly rates when possible
      if (nights >= 7) {
        const fullWeeks = Math.floor(nights / 7);
        const weeklyEndDate = addWeeks(currentDate, fullWeeks);
        
        periods.push({
          type: 'weekly',
          startDate: new Date(currentDate),
          endDate: new Date(weeklyEndDate),
          amount: 350 * fullWeeks,
          baseRate: 350,
          duration: fullWeeks
        });
        
        currentDate = new Date(weeklyEndDate);
        const remainingDays = differenceInDays(checkOut, currentDate);
        
        if (remainingDays > 0) {
          periods.push({
            type: 'daily',
            startDate: new Date(currentDate),
            endDate: new Date(checkOut),
            amount: dailyNightlyRate * remainingDays,
            baseRate: dailyNightlyRate,
            duration: remainingDays
          });
        }
      } else {
        // Less than a week
        periods.push({
          type: 'daily',
          startDate: new Date(checkIn),
          endDate: new Date(checkOut),
          amount: dailyNightlyRate * nights,
          baseRate: dailyNightlyRate,
          duration: nights
        });
      }
      break;
      
    case 'daily':
      // Use daily rate for the entire stay
      periods.push({
        type: 'daily',
        startDate: new Date(checkIn),
        endDate: new Date(checkOut),
        amount: dailyNightlyRate * nights,
        baseRate: dailyNightlyRate,
        duration: nights
      });
      break;
  }
  
  return periods;
}

type QueryResult = Awaited<ReturnType<typeof db.select>>;

export function registerRoutes(app: Express): Server {
  
  const server = createServer(app);

  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      secret: 'yoursecretkey',
      resave: false,
      saveUninitialized: false,
      cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: false, 
      },
    })
  );

  // Auth endpoints
  app.post("/api/auth/admin", async (req: Request, res: Response) => {
    const result = loginAdminSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid login data",
        details: result.error.errors,
      });
    }

    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, result.data.email),
    });

    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(
      result.data.password,
      admin.password
    );

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Store admin ID in session
    req.session.adminId = admin.id;
    
    res.json({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    });
  });

  app.post("/api/auth/guest", async (req: Request, res: Response) => {
    const result = loginGuestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid login data",
        details: result.error.errors,
      });
    }

    const guest = await db.query.guests.findFirst({
      where: and(
        eq(guests.email, result.data.email),
        eq(guests.bookingReference, result.data.bookingReference)
      ),
    });

    if (!guest) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Store guest ID in session
    req.session.guestId = guest.id;
    
    res.json({
      id: guest.id,
      name: `${guest.firstName} ${guest.lastName}`,
      email: guest.email,
    });
  });

  // Properties endpoints
  app.get("/api/properties", async (_req: Request, res: Response) => {
    const allProperties = await db.query.properties.findMany({
      with: {
        bookings: true,
      },
    });
    res.json(allProperties);
  });

  app.post("/api/properties", async (req: Request, res: Response) => {
    const property = await db.insert(properties).values(req.body).returning();
    res.json(property[0]);
  });

  app.patch("/api/properties/:id", async (req: Request, res: Response) => {
    const property = await db
      .update(properties)
      .set(req.body)
      .where(eq(properties.id, parseInt(req.params.id)))
      .returning();
    res.json(property[0]);
  });

  app.delete("/api/properties/:id", async (req: Request, res: Response) => {
    await db
      .delete(properties)
      .where(eq(properties.id, parseInt(req.params.id)));
    res.status(204).end();
  });

  app.post("/api/properties/:id/images", upload.array("images", 5), async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      const files = (req.files as Express.Multer.File[]) || [];

      if (!files.length) {
        return res.status(400).send("No files uploaded");
      }

      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        return res.status(404).send("Property not found");
      }

      const imageUrls = files.map(file => `/${file.path.split(path.sep).slice(1).join('/')}`);
      const updatedProperty = await db
        .update(properties)
        .set({
          imageUrls: imageUrls
        })
        .where(eq(properties.id, propertyId))
        .returning();

      res.json(updatedProperty[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to upload images");
    }
  });

  app.post("/api/properties/:id/check-availability", async (req: Request, res: Response) => {
    try {
      const { checkIn, checkOut } = req.body;
      const propertyId = parseInt(req.params.id);

      if (!checkIn || !checkOut) {
        return res.status(400).send("Check-in and check-out dates are required");
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Find overlapping bookings for the property
      const overlappingBookings = await db.query.bookings.findMany({
        where: and(
          eq(bookings.propertyId, propertyId),
          or(
            and(
              lte(bookings.checkIn, checkInDate),
              gte(bookings.checkOut, checkInDate)
            ),
            and(
              lte(bookings.checkIn, checkOutDate),
              gte(bookings.checkOut, checkOutDate)
            ),
            and(
              gte(bookings.checkIn, checkInDate),
              lte(bookings.checkOut, checkOutDate)
            )
          )
        ),
      });

      res.json({ available: !overlappingBookings.length });
    } catch (error) {
      console.error('Error checking availability:', error);
      res.status(500).send("Failed to check availability");
    }
  });

  // Guests endpoints - IMPORTANT: Route ordering matters! Always put specific
  // routes (/api/guests/check-email) before wildcard routes (/api/guests/:id)
  
  // 1. Specific routes first
  app.get("/api/guests/check-email", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          message: "Email parameter is required"
        });
      }

      console.log('Checking if guest exists with email:', email);

      const guest = await db.query.guests.findFirst({
        where: eq(guests.email, email)
      });

      res.json({ 
        exists: !!guest,
        guest: guest || null
      });
    } catch (error) {
      console.error('Error checking guest email:', error);
      res.status(500).json({ message: "Failed to check guest email" });
    }
  });

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
  
  app.post("/api/guests/register", async (req: Request, res: Response) => {
    try {
      console.log('Received simplified guest registration request:', req.body);

      // Validate required fields
      if (!req.body.firstName || !req.body.lastName || !req.body.email || !req.body.idNumber) {
        return res.status(400).json({
          message: "Missing required fields",
          details: "First name, last name, email, and ID number are required."
        });
      }

      // Generate a unique booking reference and access code
      const bookingReference = 'BOOK' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Insert directly with SQL to bypass Drizzle ORM that's causing issues
      const result = await pool.query(
        `INSERT INTO guests 
        (first_name, last_name, email, phone, address, id_number, id_type, booking_reference, access_code, place_of_birth, home_address) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING id, first_name, last_name, email, phone, address, id_number, id_type, booking_reference, access_code`,
        [
          req.body.firstName,
          req.body.lastName,
          req.body.email,
          req.body.phone || "Not provided",
          req.body.address || "Not provided",
          req.body.idNumber || "",
          req.body.idType || "national_id",
          bookingReference,
          accessCode,
          req.body.placeOfBirth || "",
          req.body.homeAddress || ""
        ]
      );

      // Make sure we have a valid result
      if (!result.rows || result.rows.length === 0) {
        throw new Error("No data returned from database insert");
      }

      // Format the response to match our API structure
      const newGuest = {
        id: result.rows[0].id,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        address: result.rows[0].address,
        idNumber: result.rows[0].id_number, 
        idType: result.rows[0].id_type,
        bookingReference: result.rows[0].booking_reference,
        accessCode: result.rows[0].access_code
      };

      console.log('Created guest with direct SQL:', newGuest);
      
      // Make sure we're sending only JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(201).json(newGuest);
    } catch (error) {
      console.error('Error in simplified guest registration:', error);
      
      // Make sure we're sending only JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        message: "Failed to register guest",
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

  // 2. General routes next
  app.get("/api/guests", async (_req: Request, res: Response) => {
    const allGuests = await db.query.guests.findMany({
      with: { property: true },
    });
    res.json(allGuests);
  });
  
  // 3. Parameter routes last  
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
      // Use the same implementation as our simplified endpoint, don't redirect
      console.log('Received request to original guest endpoint, processing directly');

      // Validate required fields
      if (!req.body.firstName || !req.body.lastName || !req.body.email || !req.body.idNumber) {
        return res.status(400).json({
          message: "Missing required fields",
          details: "First name, last name, email, and ID number are required."
        });
      }

      // Generate a unique booking reference and access code
      const bookingReference = 'BOOK' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Insert directly with SQL to bypass Drizzle ORM that's causing issues
      const result = await pool.query(
        `INSERT INTO guests 
        (first_name, last_name, email, phone, address, id_number, id_type, booking_reference, access_code, place_of_birth, home_address) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING id, first_name, last_name, email, phone, address, id_number, id_type, booking_reference, access_code`,
        [
          req.body.firstName,
          req.body.lastName,
          req.body.email,
          req.body.phone || "Not provided",
          req.body.address || "Not provided",
          req.body.idNumber || "",
          req.body.idType || "national_id",
          bookingReference,
          accessCode,
          req.body.placeOfBirth || "",
          req.body.homeAddress || ""
        ]
      );

      // Make sure we have a valid result
      if (!result.rows || result.rows.length === 0) {
        throw new Error("No data returned from database insert");
      }

      // Format the response to match our API structure
      const newGuest = {
        id: result.rows[0].id,
        firstName: result.rows[0].first_name,
        lastName: result.rows[0].last_name,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        address: result.rows[0].address,
        idNumber: result.rows[0].id_number, 
        idType: result.rows[0].id_type,
        bookingReference: result.rows[0].booking_reference,
        accessCode: result.rows[0].access_code
      };

      console.log('Created guest with direct SQL (original endpoint):', newGuest);
      
      // Make sure we're sending only JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(201).json(newGuest);
    } catch (error) {
      console.error('Error in original guest registration endpoint:', error);
      
      // Make sure we're sending only JSON
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        message: "Failed to register guest",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
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
      
      // Note: There might be an issue here with documentUrls type. Will fix later if needed.
      const updatedPayment = await db
        .update(payments)
        .set({
          documentUrls: sql`${documentUrls}` // Use SQL to handle array properly
        })
        .where(eq(payments.id, paymentId))
        .returning();

      res.json(updatedPayment[0]);
    } catch (error) {
      console.error(error);
      res.status(500).send("Failed to upload documents");
    }
  });

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

      // Get next payment due - note: there might be a type issue here, will fix if needed
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
    try { 
      const { type } = req.query;
      let result;
      
      if (type) {
        result = await db.select().from(assets).where(eq(assets.type, String(type)));
      } else {
        result = await db.select().from(assets);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching assets:', error);
      res.status(500).json({ message: 'Failed to fetch assets' });
    }
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

      // Generate a unique booking reference
      const bookingReference = 'BOOK' + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Insert the booking with direct SQL to avoid type issues
      const booking = await pool.query(
        `INSERT INTO bookings 
         (guest_id, property_id, check_in, check_out, status, booking_reference, total_amount, deposit_amount, notes, period_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, guest_id, property_id, check_in, check_out, status, booking_reference, total_amount, deposit_amount, notes, period_type`,
        [
          req.body.guestId,
          req.body.propertyId,
          req.body.checkIn,
          req.body.checkOut,
          req.body.status || 'pending',
          bookingReference,
          req.body.totalAmount,
          req.body.depositAmount,
          req.body.notes || '',
          req.body.periodType || 'daily'
        ]
      );

      if (!booking.rows || booking.rows.length === 0) {
        throw new Error("No data returned from database insert");
      }

      res.status(201).json(booking.rows[0]);
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({ 
        message: "Failed to create booking",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/bookings", async (req: Request, res: Response) => {
    try {
      const { guestId, propertyId, status } = req.query;
      let conditions = [];

      if (guestId) conditions.push(eq(bookings.guestId, Number(guestId)));
      if (propertyId) conditions.push(eq(bookings.propertyId, Number(propertyId)));
      if (status) conditions.push(eq(bookings.status, String(status)));

      let bookingsQuery;
      if (conditions.length > 0) {
        bookingsQuery = await db.query.bookings.findMany({
          where: and(...conditions),
          with: {
            guest: true,
            property: true
          }
        });
      } else {
        bookingsQuery = await db.query.bookings.findMany({
          with: {
            guest: true,
            property: true
          }
        });
      }

      res.json(bookingsQuery);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get("/api/properties/:id/availability", async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.id);
      const bookingsForProperty = await db.query.bookings.findMany({
        where: eq(bookings.propertyId, propertyId),
        orderBy: asc(bookings.checkIn)
      });

      // Format to calendar-friendly format
      const events = bookingsForProperty.map(booking => ({
        id: booking.id,
        title: booking.status,
        start: booking.checkIn?.toISOString().split('T')[0],
        end: booking.checkOut?.toISOString().split('T')[0],
        status: booking.status
      }));

      res.json(events);
    } catch (error) {
      console.error('Error fetching property availability:', error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  app.patch("/api/bookings/:id", async (req: Request, res: Response) => {
    try {
      const bookingId = parseInt(req.params.id);
      
      // First check if booking exists
      const existingBooking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId)
      });
      
      if (!existingBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Update booking directly with SQL to avoid TypeScript issues
      const result = await pool.query(
        `UPDATE bookings 
         SET status = COALESCE($1, status),
             guest_id = COALESCE($2, guest_id),
             property_id = COALESCE($3, property_id),
             check_in = COALESCE($4, check_in),
             check_out = COALESCE($5, check_out),
             total_amount = COALESCE($6, total_amount),
             deposit_amount = COALESCE($7, deposit_amount),
             notes = COALESCE($8, notes),
             period_type = COALESCE($9, period_type),
             updated_at = NOW()
         WHERE id = $10
         RETURNING *`,
        [
          req.body.status,
          req.body.guestId,
          req.body.propertyId,
          req.body.checkIn,
          req.body.checkOut,
          req.body.totalAmount,
          req.body.depositAmount,
          req.body.notes,
          req.body.periodType,
          bookingId
        ]
      );
      
      if (!result.rows || result.rows.length === 0) {
        throw new Error("No data returned from database update");
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating booking:', error);
      res.status(500).json({ 
        message: "Failed to update booking",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  return server;
}