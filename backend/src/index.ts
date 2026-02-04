import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import filesRouter from "./routes/files.js";
import { loadConfiguration, getAppConfig } from "./services/bootstrap.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
