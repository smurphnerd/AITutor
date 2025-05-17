import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import config from "./config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Log available AI services in development mode
if (config.nodeEnv === 'development') {
  const availableServices = [];
  if (config.ai.openai) availableServices.push('OpenAI');
  if (config.ai.gemini) availableServices.push('Gemini');
  if (config.ai.anthropic) availableServices.push('Anthropic');
  
  log(`Environment: ${config.nodeEnv}`);
  if (availableServices.length > 0) {
    log(`Available AI services: ${availableServices.join(', ')}`);
  } else {
    log('Warning: No AI services configured. Set API keys in .env file.');
  }
}

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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Get port from config, default to 5000
  // This serves both the API and the client.
  // For Replit, port 5000 is the only port that is not firewalled.
  const port = config.port || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
