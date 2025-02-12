import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Server as HttpServer } from "http";

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

async function startServer(): Promise<HttpServer> {
  // Try a range of ports starting from 3001
  const startPort = parseInt(process.env.PORT || "3001", 10);
  const maxRetries = 10;
  let currentPort = startPort;
  let retries = 0;
  let server: HttpServer | null = null;

  while (retries < maxRetries) {
    try {
      log(`Starting server on port ${currentPort}...`);
      server = registerRoutes(app);

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

      // Start server with a promise that resolves immediately after listening
      await new Promise<void>((resolve, reject) => {
        if (!server) {
          reject(new Error("Failed to create server instance"));
          return;
        }

        const cleanup = () => {
          server?.removeListener('error', onError);
          server?.removeListener('listening', onListening);
        };

        const onError = (err: NodeJS.ErrnoException) => {
          cleanup();
          if (err.code === 'EADDRINUSE') {
            log(`Port ${currentPort} is in use, trying next port`);
            server?.close();
            currentPort++;
            retries++;
            resolve(); // Continue to next iteration
          } else {
            reject(err);
          }
        };

        const onListening = () => {
          cleanup();
          log(`Server started successfully on port ${currentPort}`);

          // After successful server start, set up Vite or static serving
          if (isDev && !process.env.SKIP_VITE) {
            log("Setting up Vite middleware...");
            setupVite(app, server as HttpServer).then(() => {
              log("Vite middleware setup complete");
            }).catch((error) => {
              log(`Error setting up Vite: ${error}`);
            });
          } else {
            log("Using static file serving...");
            serveStatic(app);
          }

          resolve();
        };

        server
          .on('error', onError)
          .on('listening', onListening)
          .listen(currentPort, "0.0.0.0");
      });

      // If we get here without throwing, we've successfully started
      break;
    } catch (error) {
      log(`Attempt ${retries + 1} failed: ${error}`);
      if (retries >= maxRetries - 1) {
        throw new Error(`Failed to start server after ${maxRetries} attempts`);
      }
      retries++;
      if (server) {
        await new Promise<void>((resolve) => {
          server?.close(() => resolve());
        });
      }
    }
  }

  if (!server) {
    throw new Error("Failed to start server");
  }

  return server;
}

// Start the server
startServer().catch((error) => {
  log(`Fatal error starting server: ${error}`);
  process.exit(1);
});