import { Request, Response, Express } from "express";
import { createServer, Server } from "http";
import { log } from "./vite";
import { db, pool } from "../db";
import {
  properties,
  guests,
  bookings,
  payments,
  assets,
  admins,
  todos,
  insertAdminSchema,
  insertPropertySchema,
  insertGuestSchema,
  loginGuestSchema,
  loginAdminSchema,
  insertBookingSchema,
  insertTodoSchema,
  insertPaymentSchema,
  selectGuestSchema,
} from "../db/schema";
import { eq, and, desc, gt, lt, gte, lte, ne, or, ilike, asc } from "drizzle-orm";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Define session data type for express-session
declare module "express-session" {
  interface SessionData {
    adminId?: number;
    guestId?: number;
  }
}

// Payment calculation functions
function calculateNightlyRate(periodType: 'monthly' | 'weekly' | 'daily'): number {
  switch (periodType) {
    case 'monthly':
      return 40; // $40 per night when booking monthly
    case 'weekly':
      return 50; // $50 per night when booking weekly
    case 'daily':
      return 70; // $70 per night for daily bookings
    default:
      return 70;
  }
}

function calculateDepositAmount(plan: 'monthly' | 'weekly' | 'daily', prepaidPeriodsCount: number): number {
  // Deposit is 50% of the first period's total
  const periodLengthDays = plan === 'monthly' ? 30 : plan === 'weekly' ? 7 : 1;
  const nightlyRate = calculateNightlyRate(plan);
  const firstPeriodTotal = nightlyRate * periodLengthDays;
  return firstPeriodTotal * 0.5;
}

interface PricePeriod {
  type: 'monthly' | 'weekly' | 'daily';
  startDate: Date;
  endDate: Date;
  amount: number;
  baseRate: number;
  duration: number;
}

// This function calculates the optimal pricing periods for a stay
// It tries to maximize the number of complete months and weeks to get the best rates
function calculatePricePeriods(checkIn: Date, checkOut: Date, preferredType: 'monthly' | 'weekly' | 'daily'): PricePeriod[] {
  const result: PricePeriod[] = [];
  let currentDate = new Date(checkIn);
  const end = new Date(checkOut);
  
  // Calculate total days
  const totalDays = Math.ceil((end.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Based on preferred type, try to optimize the pricing
  switch (preferredType) {
    case 'monthly':
      // Try to get as many complete months as possible
      while (true) {
        const nextMonth = new Date(currentDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        // If next month would exceed checkout date, break
        if (nextMonth > end) break;
        
        const duration = Math.ceil((nextMonth.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        result.push({
          type: 'monthly',
          startDate: new Date(currentDate),
          endDate: new Date(nextMonth),
          amount: calculateNightlyRate('monthly') * duration,
          baseRate: calculateNightlyRate('monthly'),
          duration
        });
        
        currentDate = nextMonth;
      }
      break;
      
    case 'weekly':
      // Try to get as many complete weeks as possible
      while (true) {
        const nextWeek = new Date(currentDate);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        // If next week would exceed checkout date, break
        if (nextWeek > end) break;
        
        const duration = Math.ceil((nextWeek.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        result.push({
          type: 'weekly',
          startDate: new Date(currentDate),
          endDate: new Date(nextWeek),
          amount: calculateNightlyRate('weekly') * duration,
          baseRate: calculateNightlyRate('weekly'),
          duration
        });
        
        currentDate = nextWeek;
      }
      break;
      
    case 'daily':
      // Just calculate on a daily basis
      break;
  }
  
  // Add remaining days as daily rate
  if (currentDate < end) {
    const remainingDays = Math.ceil((end.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    result.push({
      type: 'daily',
      startDate: new Date(currentDate),
      endDate: new Date(end),
      amount: calculateNightlyRate('daily') * remainingDays,
      baseRate: calculateNightlyRate('daily'),
      duration: remainingDays
    });
  }
  
  return result;
}

// Common type for query results
type QueryResult = Awaited<ReturnType<typeof db.select>>;

// Configure storage for property images
const uploadDirectory = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Configure storage for ID documents
const idImagesDirectory = path.join(process.cwd(), 'uploads/id-images');
if (!fs.existsSync(idImagesDirectory)) {
  fs.mkdirSync(idImagesDirectory, { recursive: true });
}

// Configure storage for payment documents
const paymentDocsDirectory = path.join(process.cwd(), 'uploads/payment-docs');
if (!fs.existsSync(paymentDocsDirectory)) {
  fs.mkdirSync(paymentDocsDirectory, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDirectory);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Configure multer storage for ID documents
const idImagesStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, idImagesDirectory);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'id-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadIdImages = multer({ storage: idImagesStorage });

// Configure multer storage for payment documents
const paymentDocsStorage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, paymentDocsDirectory);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPaymentDocs = multer({ storage: paymentDocsStorage });

// Register all API routes
export function registerRoutes(app: Express): Server {
  const server = createServer(app);

  // Admin authentication
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

    req.session.adminId = admin.id;
    return res.status(200).json({
      message: "Logged in successfully",
      email: admin.email,
    });
  });

  // Guest authentication
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

    req.session.guestId = guest.id;
    return res.status(200).json({
      message: "Logged in successfully",
      email: guest.email,
    });
  });

  // Get all properties
  app.get("/api/properties", async (_req: Request, res: Response) => {
    try {
      const propertyList = await db.query.properties.findMany({
        with: {
          bookings: true,
        }
      });
      
      res.json(propertyList);
    } catch (error) {
      log(`Error fetching properties: ${error}`);
      res.status(500).json({ message: "Error fetching properties" });
    }
  });

  // Create a new property
  app.post("/api/properties", async (req: Request, res: Response) => {
    const result = insertPropertySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid property data",
        details: result.error.errors,
      });
    }

    try {
      const newProperty = await db.insert(properties).values({
        name: result.data.name,
        description: result.data.description,
        type: result.data.type,
        rate: result.data.rate,
        address: result.data.address,
        amenities: result.data.amenities || {},
        bedType: result.data.bedType,
        bathrooms: result.data.bathrooms,
        status: result.data.status,
        capacity: result.data.capacity,
        weeklyRate: result.data.weeklyRate,
        monthlyRate: result.data.monthlyRate,
        hourlyRate: result.data.hourlyRate,
        imageUrls: []
      }).returning();

      res.status(201).json(newProperty[0]);
    } catch (error) {
      log(`Error creating property: ${error}`);
      res.status(500).json({ message: "Error creating property" });
    }
  });

  // Update a property
  app.patch("/api/properties/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertyId = parseInt(id);

    try {
      const updatedProperty = await db.update(properties)
        .set(req.body)
        .where(eq(properties.id, propertyId))
        .returning();

      if (updatedProperty.length === 0) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.json(updatedProperty[0]);
    } catch (error) {
      log(`Error updating property: ${error}`);
      res.status(500).json({ message: "Error updating property" });
    }
  });

  // Delete a property
  app.delete("/api/properties/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertyId = parseInt(id);

    try {
      const deletedProperty = await db.delete(properties)
        .where(eq(properties.id, propertyId))
        .returning();

      if (deletedProperty.length === 0) {
        return res.status(404).json({ message: "Property not found" });
      }

      res.json({ message: "Property deleted successfully" });
    } catch (error) {
      log(`Error deleting property: ${error}`);
      res.status(500).json({ message: "Error deleting property" });
    }
  });

  // Upload property images
  app.post("/api/properties/:id/images", upload.array("images", 5), async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertyId = parseInt(id);

    try {
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      const files = req.files as Express.Multer.File[];
      const imageUrls = files.map(file => `/uploads/${file.filename}`);

      // Update property with new image URLs
      const updatedProperty = await db.update(properties)
        .set({
          imageUrls: [...(property.imageUrls as string[] || []), ...imageUrls],
        })
        .where(eq(properties.id, propertyId))
        .returning();

      res.status(200).json(updatedProperty[0]);
    } catch (error) {
      log(`Error uploading images: ${error}`);
      res.status(500).json({ message: "Error uploading images" });
    }
  });

  // Check property availability and calculate price
  app.post("/api/properties/:id/check-availability", async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertyId = parseInt(id);
    const { checkIn, checkOut, periodType = 'daily' } = req.body;

    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: "Check-in and check-out dates are required" });
    }

    try {
      // Check if property exists
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Parse dates
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      // Check if dates are valid
      if (checkInDate >= checkOutDate) {
        return res.status(400).json({ message: "Check-out date must be after check-in date" });
      }

      // Check if there are any overlapping bookings
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

      if (overlappingBookings.length > 0) {
        return res.status(409).json({
          available: false,
          message: "Property is not available for the selected dates",
          conflictingBookings: overlappingBookings,
        });
      }

      // Calculate price
      const days = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculate price based on preferred period type
      const pricePeriods = calculatePricePeriods(checkInDate, checkOutDate, periodType as 'monthly' | 'weekly' | 'daily');
      
      const totalAmount = pricePeriods.reduce((total, period) => total + period.amount, 0);
      const depositAmount = calculateDepositAmount(periodType as 'monthly' | 'weekly' | 'daily', 1);

      res.status(200).json({
        available: true,
        property,
        pricePeriods,
        days,
        totalAmount,
        depositAmount,
        preferredType: periodType,
      });
    } catch (error) {
      log(`Error checking availability: ${error}`);
      res.status(500).json({ message: "Error checking availability" });
    }
  });

  // Check if guest email exists
  app.get("/api/guests/check-email", async (req: Request, res: Response) => {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    try {
      const existingGuest = await db.query.guests.findFirst({
        where: eq(guests.email, email as string),
      });

      res.json({ exists: !!existingGuest, guest: existingGuest });
    } catch (error) {
      log(`Error checking guest email: ${error}`);
      res.status(500).json({ message: "Error checking guest email" });
    }
  });

  // Search for guests
  app.get("/api/guests/search", async (req: Request, res: Response) => {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    try {
      const searchResults = await db.query.guests.findMany({
        where: or(
          ilike(guests.firstName, `%${query}%`),
          ilike(guests.lastName, `%${query}%`),
          ilike(guests.email, `%${query}%`),
          ilike(guests.phone, `%${query}%`),
          ilike(guests.bookingReference, `%${query}%`)
        ),
        orderBy: desc(guests.createdAt),
      });

      res.json(searchResults);
    } catch (error) {
      log(`Error searching guests: ${error}`);
      res.status(500).json({ message: "Error searching guests" });
    }
  });

  // Get all guests
  app.get("/api/guests", async (_req: Request, res: Response) => {
    try {
      const guestList = await db.query.guests.findMany({
        orderBy: desc(guests.createdAt),
      });
      
      res.json(guestList);
    } catch (error) {
      log(`Error fetching guests: ${error}`);
      res.status(500).json({ message: "Error fetching guests" });
    }
  });

  // Get specific guest
  app.get("/api/guests/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const guestId = parseInt(id);

    try {
      const guest = await db.query.guests.findFirst({
        where: eq(guests.id, guestId),
        with: {
          bookings: {
            with: {
              property: true,
              payments: true,
            }
          }
        }
      });

      if (!guest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      res.json(guest);
    } catch (error) {
      log(`Error fetching guest: ${error}`);
      res.status(500).json({ message: "Error fetching guest" });
    }
  });

  // Register a new guest
  app.post("/api/guests/register", async (req: Request, res: Response) => {
    const result = insertGuestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid guest data",
        details: result.error.errors,
      });
    }

    try {
      // Generate booking reference if not provided
      const bookingReference = result.data.bookingReference || 
        Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Check if email already exists
      const existingGuest = await db.query.guests.findFirst({
        where: eq(guests.email, result.data.email),
      });

      if (existingGuest) {
        return res.status(409).json({ 
          message: "Guest with this email already exists",
          guestId: existingGuest.id
        });
      }

      // Create new guest
      const newGuest = await db.insert(guests).values({
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        email: result.data.email,
        phone: result.data.phone,
        dateOfBirth: result.data.dateOfBirth ? new Date(result.data.dateOfBirth) : null,
        nationality: result.data.nationality || null,
        idType: result.data.idType || null,
        idNumber: result.data.idNumber || null,
        idImage: result.data.idImage || null,
        homeAddress: result.data.homeAddress || null,
        placeOfBirth: result.data.placeOfBirth || null,
        personalNumber: result.data.personalNumber || null,
        accessCode: result.data.accessCode || null,
        idExpiryDate: result.data.idExpiryDate ? new Date(result.data.idExpiryDate) : null,
        bookingReference,
        passcode: result.data.passcode || null,
      }).returning();

      // Set session
      req.session.guestId = newGuest[0].id;

      res.status(201).json(newGuest[0]);
    } catch (error) {
      log(`Error creating guest: ${error}`);
      res.status(500).json({ message: "Error creating guest" });
    }
  });

  // Create a new guest (admin route)
  app.post("/api/guests", async (req: Request, res: Response) => {
    const result = insertGuestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid guest data",
        details: result.error.errors,
      });
    }

    try {
      // Generate booking reference if not provided
      const bookingReference = result.data.bookingReference || 
        Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create new guest
      const newGuest = await db.insert(guests).values({
        firstName: result.data.firstName,
        lastName: result.data.lastName,
        email: result.data.email,
        phone: result.data.phone,
        dateOfBirth: result.data.dateOfBirth ? new Date(result.data.dateOfBirth) : null,
        nationality: result.data.nationality || null,
        idType: result.data.idType || null,
        idNumber: result.data.idNumber || null,
        idImage: result.data.idImage || null,
        homeAddress: result.data.homeAddress || null,
        placeOfBirth: result.data.placeOfBirth || null,
        personalNumber: result.data.personalNumber || null,
        accessCode: result.data.accessCode || null,
        idExpiryDate: result.data.idExpiryDate ? new Date(result.data.idExpiryDate) : null,
        bookingReference,
        passcode: result.data.passcode || null,
      }).returning();

      res.status(201).json(newGuest[0]);
    } catch (error) {
      log(`Error creating guest: ${error}`);
      res.status(500).json({ message: "Error creating guest" });
    }
  });

  // Get today's check-ins and check-outs
  app.get("/api/guests/today", async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Fetch bookings with check-ins today
      const checkIns = await db.query.bookings.findMany({
        where: and(
          gte(bookings.checkIn, today),
          lt(bookings.checkIn, tomorrow)
        ),
        with: {
          guest: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              idNumber: true,
              nationality: true,
              bookingReference: true,
              createdAt: true
            }
          },
          property: {
            columns: {
              id: true,
              name: true,
              address: true
            }
          },
        },
        orderBy: bookings.checkIn
      });

      // Fetch bookings with check-outs today
      const checkOuts = await db.query.bookings.findMany({
        where: and(
          gte(bookings.checkOut, today),
          lt(bookings.checkOut, tomorrow)
        ),
        with: {
          guest: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              idNumber: true,
              nationality: true,
              bookingReference: true,
              createdAt: true
            }
          },
          property: {
            columns: {
              id: true,
              name: true,
              address: true
            }
          },
        },
        orderBy: bookings.checkOut
      });
      
      // Process the bookings to include guest and property information in a format the client expects
      const processedCheckIns = checkIns.map(booking => {
        if (!booking.guest) return booking;
        
        return {
          ...booking,
          guest: {
            ...booking.guest,
            name: `${booking.guest.firstName} ${booking.guest.lastName}`,
            property: booking.property?.name || 'Unknown',
            roomNumber: booking.roomNumber || 'Not assigned'
          }
        };
      });
      
      const processedCheckOuts = checkOuts.map(booking => {
        if (!booking.guest) return booking;
        
        return {
          ...booking,
          guest: {
            ...booking.guest,
            name: `${booking.guest.firstName} ${booking.guest.lastName}`,
            property: booking.property?.name || 'Unknown',
            roomNumber: booking.roomNumber || 'Not assigned'
          }
        };
      });

      res.json({
        checkIns: processedCheckIns,
        checkOuts: processedCheckOuts,
        date: today.toISOString()
      });
    } catch (error) {
      log(`Error fetching today's guests: ${error}`);
      res.status(500).json({ message: "Error fetching today's guests" });
    }
  });

  // Get all payments
  app.get("/api/payments", async (req: Request, res: Response) => {
    const { guestId, status } = req.query;
    
    try {
      let conditions = [];
      
      if (guestId) {
        conditions.push(eq(payments.guestId, parseInt(guestId as string)));
      }
      
      if (status) {
        conditions.push(eq(payments.status, status as string));
      }
      
      const paymentList = await db.query.payments.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          guest: true,
          booking: {
            with: {
              property: true
            }
          }
        },
        orderBy: desc(payments.createdAt),
      });
      
      res.json(paymentList);
    } catch (error) {
      log(`Error fetching payments: ${error}`);
      res.status(500).json({ message: "Error fetching payments" });
    }
  });

  // Create a new payment
  app.post("/api/payments", async (req: Request, res: Response) => {
    const result = insertPaymentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid payment data",
        details: result.error.errors,
      });
    }

    try {
      const newPayment = await db.insert(payments).values({
        amount: result.data.amount,
        method: result.data.method,
        status: result.data.status,
        type: result.data.type,
        dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
        paymentDate: result.data.paymentDate ? new Date(result.data.paymentDate) : null,
        notes: result.data.notes || null,
        guestId: result.data.guestId,
        bookingId: result.data.bookingId,
        documents: result.data.documents || [],
        referenceNumber: result.data.referenceNumber || `PMT-${Date.now().toString(36).toUpperCase()}`,
      }).returning();

      res.status(201).json(newPayment[0]);
    } catch (error) {
      log(`Error creating payment: ${error}`);
      res.status(500).json({ message: "Error creating payment" });
    }
  });

  // Confirm a payment
  app.patch("/api/payments/:id/confirm", async (req: Request, res: Response) => {
    const { id } = req.params;
    const paymentId = parseInt(id);
    const { paymentDate, method, referenceNumber } = req.body;

    if (!paymentDate) {
      return res.status(400).json({ message: "Payment date is required" });
    }

    try {
      const updatedPayment = await db.update(payments)
        .set({
          status: "paid",
          paymentDate: new Date(paymentDate),
          method: method || "cash",
          referenceNumber: referenceNumber || `REF-${Date.now().toString(36).toUpperCase()}`,
        })
        .where(eq(payments.id, paymentId))
        .returning();

      if (updatedPayment.length === 0) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json(updatedPayment[0]);
    } catch (error) {
      log(`Error confirming payment: ${error}`);
      res.status(500).json({ message: "Error confirming payment" });
    }
  });

  // Upload payment documents
  app.post("/api/payments/:id/documents", uploadPaymentDocs.array("documents", 5), async (req: Request, res: Response) => {
    const { id } = req.params;
    const paymentId = parseInt(id);

    try {
      const payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const files = req.files as Express.Multer.File[];
      const docUrls = files.map(file => `/uploads/payment-docs/${file.filename}`);

      // Update payment with new document URLs
      const updatedPayment = await db.update(payments)
        .set({
          documents: [...(payment.documents as string[] || []), ...docUrls],
        })
        .where(eq(payments.id, paymentId))
        .returning();

      res.status(200).json(updatedPayment[0]);
    } catch (error) {
      log(`Error uploading payment documents: ${error}`);
      res.status(500).json({ message: "Error uploading payment documents" });
    }
  });

  // Get payment details
  app.get("/api/payments/:id/details", async (req: Request, res: Response) => {
    const { id } = req.params;
    const paymentId = parseInt(id);

    try {
      const payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
        with: {
          guest: true,
          booking: {
            with: {
              property: true
            }
          }
        }
      });

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json(payment);
    } catch (error) {
      log(`Error fetching payment details: ${error}`);
      res.status(500).json({ message: "Error fetching payment details" });
    }
  });

  // Get all assets
  app.get("/api/assets", async (req: Request, res: Response) => {
    const { propertyId } = req.query;
    
    try {
      let assetList;
      
      if (propertyId) {
        assetList = await db.query.assets.findMany({
          where: eq(assets.propertyId, parseInt(propertyId as string)),
        });
      } else {
        assetList = await db.query.assets.findMany({});
      }
      
      res.json(assetList);
    } catch (error) {
      log(`Error fetching assets: ${error}`);
      res.status(500).json({ message: "Error fetching assets" });
    }
  });

  // Get guest information for public dashboard
  app.get("/api/guest-info", async (_req: Request, res: Response) => {
    try {
      // This endpoint provides general information for the guest dashboard
      // that doesn't require authentication
      const guestInfo = {
        location: {
          title: "Our Location",
          address: "123 Ocean Drive, Beachside, CA 90210",
          coordinates: { lat: 34.0522, lng: -118.2437 },
          directions: [
            "From the airport, take the Airport Express Bus to Central Station",
            "From Central Station, you can take a taxi directly to our property",
            "If driving, follow GPS directions to '123 Ocean Drive' and look for our blue entrance"
          ],
          parkingInfo: "Free parking available on premises. Please park only in designated spots.",
          publicTransport: "Bus routes 10, 15, and 22 stop within a 5-minute walk from our property."
        },
        checkInOutInfo: {
          checkInTime: "3:00 PM - 8:00 PM",
          checkOutTime: "11:00 AM",
          lateCheckIn: "Late check-in after 8:00 PM is available with prior arrangement. Additional $25 fee applies.",
          earlyCheckIn: "Early check-in (from 1:00 PM) is subject to availability for an additional $20 fee.",
          lateCheckOut: "Late checkout (until 1:00 PM) can be arranged for an additional $20 fee, subject to availability.",
          procedures: [
            "Please have your ID and booking confirmation ready upon arrival",
            "Our staff will provide keys/access codes and a brief orientation of the property",
            "For contactless check-in, download our mobile app or request the door code in advance"
          ],
          specialRequests: "Please inform us of any special requirements at least 48 hours in advance."
        },
        nearbyAttractions: {
          restaurants: [
            { name: "Oceanview Grill", distance: "0.3 miles", description: "Seafood restaurant with stunning views" },
            { name: "Luigi's Pizzeria", distance: "0.5 miles", description: "Authentic Italian pizza and pasta" },
            { name: "The Green Cafe", distance: "0.2 miles", description: "Vegan and vegetarian options" }
          ],
          shops: [
            { name: "Beachside Market", distance: "0.1 miles", description: "Convenience store with essentials" },
            { name: "Ocean Mall", distance: "1.2 miles", description: "Shopping center with various stores" },
            { name: "Farmers Market", distance: "0.8 miles", description: "Local produce, open Wednesdays & Saturdays" }
          ],
          attractions: [
            { name: "Sunset Beach", distance: "0.4 miles", description: "Beautiful beach with surfing and swimming" },
            { name: "City Museum", distance: "1.5 miles", description: "Historical and art exhibits" },
            { name: "Hillside Park", distance: "0.7 miles", description: "Hiking trails and picnic areas" }
          ],
          services: [
            { name: "City Hospital", distance: "2.1 miles", description: "24/7 emergency services" },
            { name: "Pharmacy", distance: "0.3 miles", description: "Open daily 8 AM - 10 PM" },
            { name: "Police Station", distance: "1.0 mile", description: "Local police department" }
          ]
        },
        houseRules: {
          generalRules: [
            "No smoking inside the property",
            "No parties or events without prior approval",
            "Quiet hours from 10:00 PM to 8:00 AM",
            "Pets allowed only in designated pet-friendly units with prior approval"
          ],
          emergencyContacts: [
            { name: "Property Manager", phone: "555-123-4567" },
            { name: "Maintenance", phone: "555-765-4321" },
            { name: "Emergency Services", phone: "911" }
          ]
        }
      };
      
      res.json(guestInfo);
    } catch (error) {
      log(`Error fetching guest info: ${error}`);
      res.status(500).json({ message: "Error fetching guest information" });
    }
  });

  // Get guest dashboard data for a specific guest
  app.get("/api/guest-dashboard/:guestId", async (req: Request, res: Response) => {
    const { guestId } = req.params;
    const id = parseInt(guestId);

    try {
      // Verify guest exists
      const guest = await db.query.guests.findFirst({
        where: eq(guests.id, id),
      });

      if (!guest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      // Get guest's bookings with property and payment info
      const bookings = await db.query.bookings.findMany({
        where: eq(bookings.guestId, id),
        with: {
          property: true,
          payments: true
        },
        orderBy: desc(bookings.createdAt)
      });

      // Find current or upcoming booking
      const now = new Date();
      const currentBooking = bookings.find(b => 
        (new Date(b.checkIn) <= now && new Date(b.checkOut) >= now) || 
        new Date(b.checkIn) > now
      );

      const dashboardData = {
        guest,
        bookings,
        currentBooking,
        // Add property-specific information for the current booking
        propertyInfo: currentBooking ? {
          name: currentBooking.property?.name,
          location: {
            address: currentBooking.property?.address || "123 Default Street",
            // More location details would come from property data
          }
        } : null,
        // Messages system would integrate here
        messages: [
          {
            id: 1,
            sender: "Property Manager",
            content: "Welcome to your stay! Let us know if you need anything.",
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
          },
          {
            id: 2, 
            sender: "Maintenance",
            content: "The pool will be closed for cleaning tomorrow from 10am-12pm.",
            timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
          }
        ]
      };

      res.json(dashboardData);
    } catch (error) {
      log(`Error fetching guest dashboard: ${error}`);
      res.status(500).json({ message: "Error fetching guest dashboard data" });
    }
  });

  // Get booking data for a guest using booking reference and email
  app.get("/api/bookings/guest", async (req: Request, res: Response) => {
    const { ref, email } = req.query;

    if (!ref || !email) {
      return res.status(400).json({ message: "Booking reference and email are required" });
    }

    try {
      // Find the guest with matching email and booking reference
      const guest = await db.query.guests.findFirst({
        where: and(
          eq(guests.email, email as string),
          eq(guests.bookingReference, ref as string)
        )
      });

      if (!guest) {
        return res.status(404).json({ message: "Guest not found with provided credentials" });
      }

      // Find the booking for this guest
      const booking = await db.query.bookings.findFirst({
        where: eq(bookings.guestId, guest.id),
        with: {
          property: true,
          payments: true,
          guest: true
        },
        orderBy: desc(bookings.createdAt)
      });

      if (!booking) {
        return res.status(404).json({ message: "No booking found for this guest" });
      }

      res.json(booking);
    } catch (error) {
      log(`Error fetching guest booking: ${error}`);
      res.status(500).json({ message: "Error fetching booking data" });
    }
  });

  // Get messages for a guest
  app.get("/api/messages/:guestId", async (req: Request, res: Response) => {
    const { guestId } = req.params;
    const id = parseInt(guestId);

    try {
      // In a real application, this would fetch from a messages table
      // For demo purposes, returning mock messages
      const messages = [
        {
          id: 1,
          guestId: id,
          sender: "Property Manager",
          content: "Welcome to your stay! Let us know if you need anything.",
          timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000)
        },
        {
          id: 2,
          guestId: id,
          sender: "Maintenance",
          content: "The pool will be closed for cleaning tomorrow from 10am-12pm.",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
        },
        {
          id: 3,
          guestId: id,
          sender: "Reception",
          content: "We've left a welcome basket at your door. Enjoy!",
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000)
        }
      ];

      res.json(messages);
    } catch (error) {
      log(`Error fetching messages: ${error}`);
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  // Get all todos
  app.get("/api/todos", async (_req: Request, res: Response) => {
    try {
      const todoList = await db.query.todos.findMany({
        orderBy: [
          // Using 'completed' field as defined in the schema instead of 'isCompleted'
          asc(todos.completed),
          asc(todos.dueDate)
        ],
      });
      
      // Transform the response to match the expected format in the frontend
      const formattedTodos = todoList.map(todo => ({
        ...todo,
        // Add any additional fields the frontend might be expecting
        isCompleted: todo.completed,
        priority: todo.description?.includes('high') ? 'high' : 
                 todo.description?.includes('low') ? 'low' : 'medium'
      }));
      
      res.json(formattedTodos);
    } catch (error) {
      log(`Error fetching todos: ${error}`);
      res.status(500).json({ message: "Error fetching todos" });
    }
  });

  // Create a new todo
  app.post("/api/todos", async (req: Request, res: Response) => {
    const result = insertTodoSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid todo data",
        details: result.error.errors,
      });
    }

    try {
      // Using the proper schema fields that exist in the database
      const newTodo = await db.insert(todos).values({
        title: result.data.title,
        description: result.data.description || null,
        dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
        completed: result.data.completed || false,
      }).returning();

      // Transform to match expected format
      const formattedTodo = {
        ...newTodo[0],
        isCompleted: newTodo[0].completed,
        priority: 'medium'
      };

      res.status(201).json(formattedTodo);
    } catch (error) {
      log(`Error creating todo: ${error}`);
      res.status(500).json({ message: "Error creating todo" });
    }
  });

  // Update a todo
  app.patch("/api/todos/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const todoId = parseInt(id);
    
    try {
      // Check if the todo exists
      const existingTodo = await db.query.todos.findFirst({
        where: eq(todos.id, todoId)
      });
      
      if (!existingTodo) {
        return res.status(404).json({ message: "Todo not found" });
      }
      
      // Get the completed status from request body
      const completed = req.body.completed !== undefined ? req.body.completed : 
                       (req.body.isCompleted !== undefined ? req.body.isCompleted : existingTodo.completed);
      
      // Update the todo using Drizzle ORM
      const updatedTodo = await db.update(todos)
        .set({
          completed: completed,
          // Also update other fields if provided
          title: req.body.title || existingTodo.title,
          description: req.body.description || existingTodo.description,
          dueDate: req.body.dueDate || existingTodo.dueDate
        })
        .where(eq(todos.id, todoId))
        .returning();
      
      // Format the response
      res.json({
        id: updatedTodo[0].id,
        title: updatedTodo[0].title,
        description: updatedTodo[0].description,
        dueDate: updatedTodo[0].dueDate,
        completed: updatedTodo[0].completed,
        createdAt: updatedTodo[0].createdAt,
        // Add a computed priority field based on the description
        priority: updatedTodo[0].description?.includes('high') ? 'high' : 
                updatedTodo[0].description?.includes('low') ? 'low' : 'medium'
      });
    } catch (error) {
      console.error("Error updating todo:", error);
      res.status(500).json({ message: "Error updating todo" });
    }
  });

  // Create a new booking
  app.post("/api/bookings", async (req: Request, res: Response) => {
    const result = insertBookingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Invalid booking data",
        details: result.error.errors,
      });
    }

    try {
      // Check if property exists
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, result.data.propertyId),
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Check if guest exists
      const guest = await db.query.guests.findFirst({
        where: eq(guests.id, result.data.guestId),
      });

      if (!guest) {
        return res.status(404).json({ message: "Guest not found" });
      }

      // Parse dates
      const checkInDate = new Date(result.data.checkIn);
      const checkOutDate = new Date(result.data.checkOut);

      // Create new booking
      const newBooking = await db.insert(bookings).values({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: result.data.status,
        guestId: result.data.guestId,
        propertyId: result.data.propertyId,
        totalAmount: result.data.totalAmount,
        depositAmount: result.data.depositAmount,
        bookingReference: result.data.bookingReference || 
          `BK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        notes: result.data.notes || null,
        paymentStatus: result.data.paymentStatus || "pending",
        guests: result.data.guests || 1,
      }).returning();

      // Check if we need to create a deposit payment
      if (result.data.createDeposit && result.data.depositAmount > 0) {
        const depositPayment = await db.insert(payments).values({
          amount: result.data.depositAmount,
          method: "cash", // Default method
          status: "pending",
          type: "deposit",
          dueDate: new Date(), // Due immediately
          guestId: result.data.guestId,
          bookingId: newBooking[0].id,
          referenceNumber: `DEP-${Date.now().toString(36).toUpperCase()}`,
        }).returning();

        return res.status(201).json({
          booking: newBooking[0],
          deposit: depositPayment[0],
        });
      }

      res.status(201).json(newBooking[0]);
    } catch (error) {
      log(`Error creating booking: ${error}`);
      res.status(500).json({ message: "Error creating booking" });
    }
  });

  // Get all bookings
  app.get("/api/bookings", async (req: Request, res: Response) => {
    const { propertyId, guestId, status } = req.query;
    
    try {
      let conditions = [];
      
      if (propertyId) {
        conditions.push(eq(bookings.propertyId, parseInt(propertyId as string)));
      }
      
      if (guestId) {
        conditions.push(eq(bookings.guestId, parseInt(guestId as string)));
      }
      
      if (status) {
        conditions.push(eq(bookings.status, status as string));
      }
      
      const bookingList = await db.query.bookings.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          guest: true,
          property: true,
          payments: true,
        },
        orderBy: desc(bookings.createdAt),
      });
      
      res.json(bookingList);
    } catch (error) {
      log(`Error fetching bookings: ${error}`);
      res.status(500).json({ message: "Error fetching bookings" });
    }
  });

  // Get property availability
  app.get("/api/properties/:id/availability", async (req: Request, res: Response) => {
    const { id } = req.params;
    const propertyId = parseInt(id);
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required" });
    }

    try {
      // Check if property exists
      const property = await db.query.properties.findFirst({
        where: eq(properties.id, propertyId),
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Parse dates
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Get all bookings for this property that overlap with the requested period
      const overlappingBookings = await db.query.bookings.findMany({
        where: and(
          eq(bookings.propertyId, propertyId),
          or(
            and(lte(bookings.checkIn, start), gte(bookings.checkOut, start)),
            and(lte(bookings.checkIn, end), gte(bookings.checkOut, end)),
            and(gte(bookings.checkIn, start), lte(bookings.checkOut, end))
          ),
          ne(bookings.status, "cancelled") // Ignore cancelled bookings
        ),
      });

      // Build availability array (true = available, false = booked)
      const availability = [];
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateString = currentDate.toISOString().split('T')[0];
        const isBooked = overlappingBookings.some(booking => {
          const bookingStart = new Date(booking.checkIn);
          const bookingEnd = new Date(booking.checkOut);
          return currentDate >= bookingStart && currentDate < bookingEnd;
        });

        availability.push({
          date: dateString,
          available: !isBooked,
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      res.json({
        propertyId,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        availability,
        overlappingBookings,
      });
    } catch (error) {
      log(`Error checking availability: ${error}`);
      res.status(500).json({ message: "Error checking availability" });
    }
  });

  // Update a booking
  app.patch("/api/bookings/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const bookingId = parseInt(id);

    try {
      const updatedBooking = await db.update(bookings)
        .set(req.body)
        .where(eq(bookings.id, bookingId))
        .returning();

      if (updatedBooking.length === 0) {
        return res.status(404).json({ message: "Booking not found" });
      }

      res.json(updatedBooking[0]);
    } catch (error) {
      log(`Error updating booking: ${error}`);
      res.status(500).json({ message: "Error updating booking" });
    }
  });

  // To support file uploads for guest ID
  app.post("/api/upload/id", uploadIdImages.single("idImage"), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const filePath = `/uploads/id-images/${req.file.filename}`;
    res.json({ path: filePath });
  });

  return server;
}