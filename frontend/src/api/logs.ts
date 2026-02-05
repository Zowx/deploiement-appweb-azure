export interface LogEntry {
  id: string;
  action: "upload" | "download" | "view" | "delete" | "list" | "error";
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  userId?: string;
  userIp?: string;
  userAgent?: string;
  details?: string;
  errorMessage?: string;
  timestamp: string;
}

export interface LogsResponse {
  count: number;
  logs: LogEntry[];
}

export interface LogStats {
  total: number;
  byAction: {
    upload: number;
    download: number;
    view: number;
    delete: number;
    list: number;
    error: number;
  };
  date: string;
}

const API_BASE = import.meta.env.VITE_API_URL?.replace("/api/files", "") || "";

export async function getLogs(params?: {
  date?: string;
  action?: string;
  limit?: number;
}): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.date) searchParams.append("date", params.date);
  if (params?.action) searchParams.append("action", params.action);
  if (params?.limit) searchParams.append("limit", String(params.limit));

  const url = `${API_BASE}/api/logs${searchParams.toString() ? `?${searchParams}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch logs");
  }

  return response.json();
}

export async function getLogStats(date?: string): Promise<LogStats> {
  const url = `${API_BASE}/api/logs/stats${date ? `?date=${date}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Failed to fetch stats");
  }

  return response.json();
}

export async function logActivity(activity: {
  action: LogEntry["action"];
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  details?: string;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/api/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    throw new Error("Failed to log activity");
  }
}
