import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add request logging middleware
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

async function startServer() {
  const startPort = parseInt(process.env.PORT || "5000", 10);
  let currentPort = startPort;

  try {
    log(`Starting server on port ${currentPort}...`);
    const server = registerRoutes(app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error occurred: ${message}`);
      res.status(status).json({ message });
    });

      // Setup middleware based on environment
      const isDev = app.get("env") === "development";
      log(`Running in ${isDev ? "development" : "production"} mode`);

      if (isDev && !process.env.SKIP_VITE) {
        log("Setting up Vite middleware...");
        await setupVite(app, server);
        log("Vite middleware setup complete");
      } else {
        log("Using static file serving...");
        serveStatic(app);
      }

      // Start server with a promise that resolves immediately after listening
      await new Promise<void>((resolve, reject) => {
        server
          .listen(currentPort, "0.0.0.0")
          .once("listening", () => {
            log(`Server started successfully on port ${currentPort}`);
            resolve();
          })
          .once("error", (err: NodeJS.ErrnoException) => {
            reject(err);
          });
      });

      // If we get here without an error, break the loop
      break;
    } catch (error) {
      log(`Attempt ${retries + 1} failed: ${error}`);
      if (retries >= maxRetries - 1) {
        log(`Failed to start server after ${maxRetries} attempts`);
        throw error;
      }
      retries++;
    }
  }
}

// Start the server
startServer().catch((error) => {
  log(`Fatal error starting server: ${error}`);
  process.exit(1);
});