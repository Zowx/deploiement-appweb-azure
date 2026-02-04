import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient, TableServiceClient } from "@azure/data-tables";

interface ActivityLog {
  action: "upload" | "download" | "delete" | "list" | "error";
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  userId?: string;
  userIp?: string;
  userAgent?: string;
  details?: string;
  errorMessage?: string;
  timestamp?: string;
}

const TABLE_NAME = "ActivityLogs";

async function getTableClient(): Promise<TableClient> {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("STORAGE_CONNECTION_STRING not configured");
  }

  const tableServiceClient =
    TableServiceClient.fromConnectionString(connectionString);

  // Create table if not exists
  try {
    await tableServiceClient.createTable(TABLE_NAME);
  } catch (error: any) {
    // Ignore if table already exists
    if (error.statusCode !== 409) {
      throw error;
    }
  }

  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

export async function logActivity(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Processing activity log request");

  try {
    const body = (await request.json()) as ActivityLog;

    // Validate required field
    if (!body.action) {
      return {
        status: 400,
        jsonBody: { error: "Missing required field: action" },
      };
    }

    const tableClient = await getTableClient();

    // Create log entry
    const now = new Date();
    const partitionKey = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const rowKey = `${now.getTime()}-${Math.random().toString(36).substring(7)}`;

    const entity = {
      partitionKey,
      rowKey,
      action: body.action,
      fileId: body.fileId || "",
      fileName: body.fileName || "",
      fileSize: body.fileSize || 0,
      userId: body.userId || "anonymous",
      userIp:
        body.userIp || request.headers.get("x-forwarded-for") || "unknown",
      userAgent:
        body.userAgent || request.headers.get("user-agent") || "unknown",
      details: body.details || "",
      errorMessage: body.errorMessage || "",
      timestamp: body.timestamp || now.toISOString(),
    };

    await tableClient.createEntity(entity);

    context.log(`Activity logged: ${body.action} - ${body.fileName || "N/A"}`);

    return {
      status: 201,
      jsonBody: {
        message: "Activity logged successfully",
        logId: `${partitionKey}/${rowKey}`,
      },
    };
  } catch (error: any) {
    context.error("Error logging activity:", error);

    return {
      status: 500,
      jsonBody: { error: "Failed to log activity", details: error.message },
    };
  }
}

// HTTP Trigger - receives events from backend
app.http("logActivity", {
  methods: ["POST"],
  authLevel: "function",
  handler: logActivity,
});
