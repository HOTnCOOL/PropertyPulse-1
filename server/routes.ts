import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { properties, guests, payments } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // Properties endpoints
  app.get("/api/properties", async (_req, res) => {
    const allProperties = await db.query.properties.findMany({
      with: { guests: true },
    });
    res.json(allProperties);
  });

  app.post("/api/properties", async (req, res) => {
    const property = await db.insert(properties).values(req.body).returning();
    res.json(property[0]);
  });

  // Guests endpoints
  app.get("/api/guests", async (_req, res) => {
    const allGuests = await db.query.guests.findMany({
      with: { property: true, payments: true },
    });
    res.json(allGuests);
  });

  app.post("/api/guests", async (req, res) => {
    const guest = await db.insert(guests).values(req.body).returning();
    res.json(guest[0]);
  });

  app.get("/api/guests/:id", async (req, res) => {
    const guest = await db.query.guests.findFirst({
      where: eq(guests.id, parseInt(req.params.id)),
      with: { property: true, payments: true },
    });
    if (!guest) return res.status(404).send("Guest not found");
    res.json(guest);
  });

  // Payments endpoints
  app.get("/api/payments", async (req, res) => {
    const { startDate, endDate } = req.query;
    let query = db.select().from(payments);
    
    if (startDate && endDate) {
      query = query.where(
        and(
          gte(payments.date, new Date(startDate as string)),
          lte(payments.date, new Date(endDate as string))
        )
      );
    }
    
    const allPayments = await query;
    res.json(allPayments);
  });

  app.post("/api/payments", async (req, res) => {
    const payment = await db.insert(payments).values(req.body).returning();
    res.json(payment[0]);
  });

  const httpServer = createServer(app);
  return httpServer;
}
