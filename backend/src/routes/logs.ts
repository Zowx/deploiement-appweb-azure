import { Router, Request, Response } from "express";
import { ensureAuthenticated } from "../services/auth.js";

interface LogEntry {
  action: string;
  timestamp?: string;
  [key: string]: unknown;
}

const router = Router();

// Get Azure Function URL and key from environment
function getFunctionConfig() {
  return {
    url: process.env.AZURE_FUNCTION_URL,
    key: process.env.AZURE_FUNCTION_KEY,
  };
}

// GET logs (proxy to Azure Function)
router.get("/", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { url, key } = getFunctionConfig();

    if (!url || !key) {
      res.status(503).json({
        error: "Logging function not configured",
      });
      return;
    }

    // Forward query params
    const params = new URLSearchParams();
    if (req.query.date) params.append("date", String(req.query.date));
    if (req.query.action) params.append("action", String(req.query.action));
    if (req.query.limit) params.append("limit", String(req.query.limit));

    const response = await fetch(`${url}/api/getlogs?${params.toString()}`, {
      headers: { "x-functions-key": key },
    });

    if (!response.ok) {
      res.status(response.status).json({
        error: "Failed to fetch logs from Azure Function",
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("[LOGS] GET / failed:", (error as Error).message);
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// POST log activity (proxy to Azure Function)
router.post("/", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { url, key } = getFunctionConfig();

    if (!url || !key) {
      res.status(503).json({
        error: "Logging function not configured",
      });
      return;
    }

    const response = await fetch(`${url}/api/logactivity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-functions-key": key },
      body: JSON.stringify({
        ...req.body,
        userIp: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      res.status(response.status).json({
        error: "Failed to log activity",
      });
      return;
    }

    const data = await response.json();
    res.status(201).json(data);
  } catch (error) {
    console.error("[LOGS] POST / failed:", (error as Error).message);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

// GET stats (aggregated data for dashboard)
router.get("/stats", ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const { url, key } = getFunctionConfig();

    if (!url || !key) {
      res.status(503).json({ error: "Logging function not configured" });
      return;
    }

    // Get today's date
    const today = new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({
      date: String(req.query.date || today),
      limit: "1000",
    });

    const response = await fetch(`${url}/api/getlogs?${params.toString()}`, {
      headers: { "x-functions-key": key },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Failed to fetch stats" });
      return;
    }

    const data = await response.json();
    const logs: LogEntry[] = data.logs || [];

    // Calculate stats
    const stats = {
      total: logs.length,
      byAction: {
        upload: logs.filter((l) => l.action === "upload").length,
        download: logs.filter((l) => l.action === "download").length,
        view: logs.filter((l) => l.action === "view").length,
        delete: logs.filter((l) => l.action === "delete").length,
        list: logs.filter((l) => l.action === "list").length,
        error: logs.filter((l) => l.action === "error").length,
      },
      date: req.query.date || today,
    };

    res.json(stats);
  } catch (error) {
    console.error("[LOGS] GET /stats failed:", (error as Error).message);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default router;
