import { app, InvocationContext, Timer } from "@azure/functions";
import { TableClient, TableServiceClient } from "@azure/data-tables";

const TABLE_NAME = "ActivityLogs";
const RETENTION_DAYS = 30;

async function getTableClient(): Promise<TableClient> {
  const connectionString = process.env.STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("STORAGE_CONNECTION_STRING not configured");
  }

  return TableClient.fromConnectionString(connectionString, TABLE_NAME);
}

export async function cleanupLogs(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log("Starting log cleanup job");

  try {
    const tableClient = await getTableClient();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    const cutoffPartition = cutoffDate.toISOString().split("T")[0];

    context.log(`Deleting logs older than ${cutoffPartition}`);

    let deletedCount = 0;

    // List all entities with partition key older than cutoff
    const entities = tableClient.listEntities({
      queryOptions: {
        filter: `PartitionKey lt '${cutoffPartition}'`,
      },
    });

    for await (const entity of entities) {
      try {
        await tableClient.deleteEntity(
          entity.partitionKey as string,
          entity.rowKey as string,
        );
        deletedCount++;
      } catch (error) {
        context.warn(
          `Failed to delete entity ${entity.partitionKey}/${entity.rowKey}`,
        );
      }
    }

    context.log(`Cleanup completed. Deleted ${deletedCount} old log entries.`);
  } catch (error: any) {
    // Table might not exist yet - that's okay
    if (error.statusCode === 404) {
      context.log(
        "Activity logs table does not exist yet. Nothing to clean up.",
      );
      return;
    }

    context.error("Error during log cleanup:", error);
    throw error;
  }
}

// Timer Trigger - runs daily at 2 AM UTC
app.timer("cleanupLogs", {
  schedule: "0 0 2 * * *",
  handler: cleanupLogs,
});
