import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import filesRouter from "./routes/files.js";
import foldersRouter from "./routes/folders.js";
import logsRouter from "./routes/logs.js";
import sseRouter from "./routes/sse.js";
import { loadConfiguration, getAppConfig } from "./services/bootstrap.js";
import prisma from "./services/prisma.js";
import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
