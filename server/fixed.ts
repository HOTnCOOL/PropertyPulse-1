import express from "express";
import { createServer } from "http";
import session from "express-session";
import { setupVite, serveStatic } from "./vite";
import { registerRoutes } from "./routes";

const app = express();

// Configure session
app.use(
  session({
    secret: "guest-dashboard-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true in production with HTTPS
  })
);

// Parse JSON body
app.use(express.json());

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Setup routes, get HTTP server instance
const server = registerRoutes(app);

// Start the server
const PORT = process.env.PORT || 5000;
async function startServer() {
  try {
    // Setup Vite in development mode
    if (process.env.NODE_ENV !== "production") {
      await setupVite(app, server);
      console.log("[express] Running in development mode");
    } else {
      serveStatic(app);
      console.log("[express] Running in production mode");
    }

    // Global error handler
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error("[express] Error:", err);
      res.status(500).json({
        message: "Internal server error",
        ...(process.env.NODE_ENV !== "production" ? { error: err.message } : {})
      });
    });

    server.listen(parseInt(PORT.toString()), "0.0.0.0", () => {
      console.log(`[express] Server started successfully on port ${PORT}, bound to 0.0.0.0`);
    });
  } catch (error) {
    console.error("[express] Failed to start server:", error);
    process.exit(1);
  }
}

console.log("[express] Starting server on port 5000...");
startServer();