import express from "express";
import helmet from "helmet";
import cors from "cors";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load env as early as possible so imported modules can read process.env
dotenv.config();

import passport from "./services/passport.js";
import authRouter from "./routes/auth.js";
import filesRouter from "./routes/files.js";
import foldersRouter from "./routes/folders.js";
import logsRouter from "./routes/logs.js";
import sseRouter from "./routes/sse.js";
import { loadConfiguration, getAppConfig } from "./services/bootstrap.js";
import prisma from "./services/prisma.js";
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// In-memory rate limiter
const rateLimitStore: Record<string, { count: number; resetTime: number }> = {};
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

function rateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const ip = req.ip || "unknown";
  const now = Date.now();

  if (!rateLimitStore[ip]) {
    rateLimitStore[ip] = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
  }

  const record = rateLimitStore[ip];

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + RATE_LIMIT_WINDOW;
  }

  record.count++;

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return res
      .status(429)
      .json({ error: "Too many requests, please try again later" });
  }

  next();
}

// Cleanup expired rate limit entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(rateLimitStore)) {
    if (now > rateLimitStore[ip].resetTime) {
      delete rateLimitStore[ip];
    }
  }
}, RATE_LIMIT_WINDOW);

const requiredEnvVars = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "SESSION_SECRET",
];

for (const v of requiredEnvVars) {
  if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
}

if (process.env.NODE_ENV === "production") {
  const productionEnvVars = ["FRONTEND_URL", "BASE_URL"];
  for (const v of productionEnvVars) {
    if (!process.env[v])
      throw new Error(`Missing required env var in production: ${v}`);
  }
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || false,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
// Session + Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24h
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());

// Apply rate limiting to API routes
app.use("/api", rateLimiter);

// Auth routes
app.use("/api", authRouter);

// Health check endpoint with DB + Storage connectivity verification
app.get("/health", async (_req, res) => {
  const checks: Record<
    string,
    { status: string; latencyMs?: number; error?: string }
  > = {};

  // Check database connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: (err as Error).message,
    };
  }

  // Check Azure Blob Storage connectivity
  const storageStart = Date.now();
  try {
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "uploads";
    if (accountName) {
      const credential = new DefaultAzureCredential();
      const blobService = new BlobServiceClient(
        `https://${accountName}.blob.core.windows.net`,
        credential,
      );
      const container = blobService.getContainerClient(containerName);
      await container.getProperties();
      checks.storage = { status: "ok", latencyMs: Date.now() - storageStart };
    } else {
      checks.storage = { status: "ok", latencyMs: 0, error: "local mode" };
    }
  } catch (err) {
    checks.storage = {
      status: "error",
      latencyMs: Date.now() - storageStart,
      error: (err as Error).message,
    };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "ok");

  let config;
  try {
    config = getAppConfig();
  } catch {
    config = {
      appName: "CloudAzure",
      environment: "unknown",
      apiVersion: "1.0.0",
    };
  }

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    app: config.appName,
    environment: config.environment,
    version: config.apiVersion,
    checks,
  });
});

app.use("/api/files", filesRouter);
app.use("/api/logs", logsRouter);
app.use("/api/folders", foldersRouter);
app.use("/api", sseRouter);

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../public")));

// SPA fallback
app.get("*", (req: express.Request, res: express.Response) => {
  if (req.path.startsWith("/api") || req.path === "/health") {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Global error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  },
);

// Bootstrap application
async function startServer() {
  try {
    // Load configuration from Azure Key Vault and App Configuration
    await loadConfiguration();

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown for Prisma
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});
