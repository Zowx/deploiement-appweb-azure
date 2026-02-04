import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { TableClient, TableServiceClient } from "@azure/data-tables";

const TABLE_NAME = "ActivityLogs";

async function getTableClient(): Promise<TableClient> {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("STORAGE_CONNECTION_STRING not configured");
  }

  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

export async function getLogs(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log("Fetching activity logs");

  try {
    const tableClient = await getTableClient();

    // Get query parameters
    const date = request.query.get("date"); // YYYY-MM-DD
    const action = request.query.get("action");
    const limit = parseInt(request.query.get("limit") || "100");

    let filter = "";

    if (date) {
      filter = `PartitionKey eq '${date}'`;
    }

    if (action) {
      filter = filter
        ? `${filter} and action eq '${action}'`
        : `action eq '${action}'`;
    }

    const logs: any[] = [];
    const options = filter ? { queryOptions: { filter } } : {};

    const entities = tableClient.listEntities(options);

    for await (const entity of entities) {
      logs.push({
        id: `${entity.partitionKey}/${entity.rowKey}`,
        action: entity.action,
        fileId: entity.fileId,
        fileName: entity.fileName,
        fileSize: entity.fileSize,
        userId: entity.userId,
        userIp: entity.userIp,
        timestamp: entity.timestamp,
        details: entity.details,
        errorMessage: entity.errorMessage,
      });

      if (logs.length >= limit) break;
    }

    // Sort by timestamp descending
    logs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return {
      status: 200,
      jsonBody: {
        count: logs.length,
        logs,
      },
    };
  } catch (error: any) {
    context.error("Error fetching logs:", error);

    // Table might not exist yet
    if (error.statusCode === 404) {
      return {
        status: 200,
        jsonBody: { count: 0, logs: [] },
      };
    }

    return {
      status: 500,
      jsonBody: { error: "Failed to fetch logs", details: error.message },
    };
  }
}

// HTTP Trigger - retrieve logs
app.http("getLogs", {
  methods: ["GET"],
  authLevel: "function",
  handler: getLogs,
});
