import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { db } from "@db";
import { properties, guests, payments, todos, assets, bookings } from "@db/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";
import express from "express";
import { addDays, parseISO, isWithinInterval } from "date-fns";
import { sql } from "drizzle-orm";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed'));
      return;
    }
    cb(null, true);
  }
});

export function registerRoutes(app: Express): Server {
  // Serve static files from uploads directory
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Properties endpoints
  app.get("/api/properties", async (_req, res) => {
    const allProperties = await db.query.properties.findMany();
    res.json(allProperties);
  });

  app.post("/api/properties", async (req, res) => {
    const property = await db.insert(properties).values(req.body).returning();
    res.json(property[0]);
  });

  app.patch("/api/properties/:id", async (req, res) => {
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

  app.delete("/api/properties/:id", async (req, res) => {
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
  app.post("/api/properties/:id/images", upload.array("images", 5), async (req, res) => {
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
  app.post("/api/properties/:id/check-availability", async (req, res) => {
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
  app.get("/api/guests", async (_req, res) => {
    const allGuests = await db.query.guests.findMany({
      with: { property: true },
    });
    res.json(allGuests);
  });

  app.get("/api/guests/today", async (_req, res) => {
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

  app.post("/api/guests", async (req, res) => {
    const guest = await db.insert(guests).values(req.body).returning();
    res.json(guest[0]);
  });

  app.get("/api/guests/:id", async (req, res) => {
    const guest = await db.query.guests.findFirst({
      where: eq(guests.id, parseInt(req.params.id)),
      with: { property: true },
    });
    if (!guest) return res.status(404).send("Guest not found");
    res.json(guest);
  });

  // Payments endpoints
  app.get("/api/payments", async (req, res) => {
    const { startDate, endDate, status, guestId } = req.query;
    let query = db.select().from(payments);

    if (startDate && endDate) {
      query = query.where(
        and(
          gte(payments.date, new Date(String(startDate))),
          lte(payments.date, new Date(String(endDate)))
        )
      );
    }

    if (status) {
      query = query.where(eq(payments.status, String(status)));
    }

    if (guestId) {
      query = query.where(eq(payments.guestId, Number(guestId)));
    }

    const allPayments = await query;
    res.json(allPayments);
  });

  app.post("/api/payments", async (req, res) => {
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

  app.patch("/api/payments/:id/confirm", async (req, res) => {
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

  // Assets endpoints
  app.get("/api/assets", async (req, res) => {
    const { type } = req.query;
    let query = db.select().from(assets);

    if (type) {
      query = query.where(eq(assets.type, String(type)));
    }

    const allAssets = await query;
    res.json(allAssets);
  });

  // Todos endpoints
  app.get("/api/todos", async (_req, res) => {
    const allTodos = await db.select().from(todos);
    res.json(allTodos);
  });

  app.post("/api/todos", async (req, res) => {
    const todo = await db.insert(todos).values(req.body).returning();
    res.json(todo[0]);
  });

  app.patch("/api/todos/:id", async (req, res) => {
    const todo = await db
      .update(todos)
      .set(req.body)
      .where(eq(todos.id, parseInt(req.params.id)))
      .returning();
    res.json(todo[0]);
  });

  // Bookings endpoints
  app.post("/api/bookings", async (req, res) => {
    try {
      const { propertyId, guestId, checkIn, checkOut, totalAmount, notes } = req.body;

      // Validate the request body
      const result = insertBookingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: "Invalid booking data",
          details: result.error.message,
        });
      }

      // Check if the property is available for these dates
      const overlappingBookings = await db.query.bookings.findFirst({
        where: and(
          eq(bookings.propertyId, propertyId),
          eq(bookings.status, "confirmed"),
          or(
            and(
              lte(bookings.checkIn, result.data.checkIn),
              gte(bookings.checkOut, result.data.checkIn)
            ),
            and(
              lte(bookings.checkIn, result.data.checkOut),
              gte(bookings.checkOut, result.data.checkOut)
            ),
            and(
              gte(bookings.checkIn, result.data.checkIn),
              lte(bookings.checkOut, result.data.checkOut)
            )
          )
        ),
      });

      if (overlappingBookings) {
        return res.status(400).json({
          message: "Property is not available for the selected dates",
        });
      }

      // Create the booking
      const [booking] = await db.insert(bookings)
        .values({
          propertyId,
          guestId,
          checkIn: result.data.checkIn,
          checkOut: result.data.checkOut,
          totalAmount,
          notes,
          status: "pending",
        })
        .returning();

      res.json(booking);
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({
        message: "Failed to create booking",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/bookings", async (req, res) => {
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

  app.get("/api/properties/:id/availability", async (req, res) => {
    try {
      const propertyId = parseInt(req.params.id);
      const { start, end } = req.query;

      if (!start || !end) {
        return res.status(400).send("Start and end dates are required");
      }

      const startDate = parseISO(String(start));
      const endDate = parseISO(String(end));

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
          isWithinInterval(currentDate, {
            start: new Date(booking.checkIn),
            end: new Date(booking.checkOut),
          })
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

  app.patch("/api/bookings/:id", async (req, res) => {
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


  const httpServer = createServer(app);
  return httpServer;
}