import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "./services/passport.js";
import authRouter from "./routes/auth.js";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import filesRouter from "./routes/files.js";
import foldersRouter from "./routes/folders.js";
import logsRouter from "./routes/logs.js";
import sseRouter from "./routes/sse.js";
import { loadConfiguration, getAppConfig } from "./services/bootstrap.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

const requiredEnvVars = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"];

for (const v of requiredEnvVars) {
  if (!process.env[v]) throw new Error(`Missing required env var: ${v}`);
}

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
// Session + Passport
app.use(
  session({
    secret: process.env.SESSION_SECRET ||
      (process.env.NODE_ENV === "production" ? (() =>
      { throw new Error("SESSION_SECRET must be set in production"); })() : "dev_session_secret"),
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

// Auth routes
app.use("/api", authRouter);

// Health check endpoint with config info
app.get("/health", (_req, res) => {
  try {
    const config = getAppConfig();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      app: config.appName,
      environment: config.environment,
      version: config.apiVersion,
    });
  } catch {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      app: "CloudAzure",
      environment: "unknown",
      version: "1.0.0",
    });
  }
});

app.use("/api/files", filesRouter);
app.use("/api/logs", logsRouter);
app.use("/api/folders", foldersRouter);
app.use("/api", sseRouter);

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../public")));

// SPA fallback
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

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
