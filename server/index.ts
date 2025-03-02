import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.fixed"; // Changed to use fixed routes
import { setupVite, serveStatic, log } from "./vite";
import { registerOCRRoutes } from "./routes/ocr";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware with more detailed error information
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Add health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  const port = process.env.PORT || 5000; // Use PORT environment variable or fallback to 5000

  try {
    log(`Starting server on port ${port}...`);
    const server = registerRoutes(app);
    
    // Register OCR routes
    log('Registering OCR and document management routes...');
    registerOCRRoutes(app);

    // Error handling middleware with detailed logging
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      const stack = err.stack || "";
      log(`Error occurred: ${message}\nStack: ${stack}`);
      res.status(status).json({ message });
    });

    // Setup middleware based on environment
    const isDev = app.get("env") === "development";
    log(`Running in ${isDev ? "development" : "production"} mode`);

    if (isDev && !process.env.SKIP_VITE) {
      try {
        log("Setting up Vite middleware...");
        await setupVite(app, server);
        log("Vite middleware setup complete");
      } catch (viteError) {
        log(`Vite middleware setup failed: ${viteError}`);
        // Fall back to static serving if Vite fails
        log("Falling back to static file serving...");
        serveStatic(app);
      }
    } else {
      log("Using static file serving...");
      serveStatic(app);
    }

    // Start server
    await new Promise<void>((resolve, reject) => {
      // Listen on the numeric port and bind to all interfaces (0.0.0.0)
      const serverInstance = server.listen(Number(port), '0.0.0.0');
      
      serverInstance.once("listening", () => {
        log(`Server started successfully on port ${port}, bound to 0.0.0.0`);
        resolve();
      });
      
      serverInstance.once("error", (err: NodeJS.ErrnoException) => {
        log(`Server startup error: ${err.message}`);
        reject(err);
      });
    });

  } catch (error) {
    log(`Fatal error starting server: ${error}`);
    // Don't exit process on error, let it attempt to recover
    throw error;
  }
}

// Start the server with error handling
startServer().catch((error) => {
  log(`Fatal error starting server: ${error}`);
  // Wait before retrying to avoid rapid restarts
  setTimeout(() => {
    log("Attempting server restart...");
    startServer();
  }, 5000);
});