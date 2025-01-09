import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { properties, guests, payments, todos } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  // Properties endpoints
  app.get("/api/properties", async (_req, res) => {
    const allProperties = await db.query.properties.findMany();
    res.json(allProperties);
  });

  app.post("/api/properties", async (req, res) => {
    const property = await db.insert(properties).values(req.body).returning();
    res.json(property[0]);
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
    const { startDate, endDate, status } = req.query;
    let query = db.select().from(payments);

    if (startDate && endDate) {
      query = query.where(
        and(
          gte(payments.date, new Date(startDate as string)),
          lte(payments.date, new Date(endDate as string))
        )
      );
    }

    if (status) {
      query = query.where(eq(payments.status, status as string));
    }

    const allPayments = await query;
    res.json(allPayments);
  });

  app.post("/api/payments", async (req, res) => {
    const payment = await db.insert(payments).values(req.body).returning();
    res.json(payment[0]);
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

  const httpServer = createServer(app);
  return httpServer;
}