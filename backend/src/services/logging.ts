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
}

class LoggingService {
  private functionUrl: string | null = null;
  private functionKey: string | null = null;
  private enabled: boolean = false;

  configure(functionUrl: string, functionKey: string) {
    this.functionUrl = functionUrl;
    this.functionKey = functionKey;
    this.enabled = true;
    console.log("[Logging] Azure Function logging configured");
  }

  async logActivity(log: ActivityLog, req?: { ip?: string; headers?: any }) {
    // Always log to console
    console.log(
      `[Activity] ${log.action} - ${log.fileName || log.fileId || "N/A"}`,
    );

    if (!this.enabled || !this.functionUrl) {
      return;
    }

    try {
      const payload = {
        ...log,
        userIp: log.userIp || req?.ip || "unknown",
        userAgent: log.userAgent || req?.headers?.["user-agent"] || "unknown",
        timestamp: new Date().toISOString(),
      };

      const url = `${this.functionUrl}/api/logActivity?code=${this.functionKey}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(
          `[Logging] Failed to send log to Azure Function: ${response.status}`,
        );
      }
    } catch (error) {
      // Don't let logging failures affect the main application
      console.warn("[Logging] Error sending log to Azure Function:", error);
    }
  }

  async logUpload(
    fileId: string,
    fileName: string,
    fileSize: number,
    req?: any,
  ) {
    await this.logActivity(
      {
        action: "upload",
        fileId,
        fileName,
        fileSize,
        details: `File uploaded: ${fileName} (${fileSize} bytes)`,
      },
      req,
    );
  }

  async logDownload(fileId: string, fileName: string, req?: any) {
    await this.logActivity(
      {
        action: "download",
        fileId,
        fileName,
        details: `File downloaded: ${fileName}`,
      },
      req,
    );
  }

  async logDelete(fileId: string, fileName: string, req?: any) {
    await this.logActivity(
      {
        action: "delete",
        fileId,
        fileName,
        details: `File deleted: ${fileName}`,
      },
      req,
    );
  }

  async logList(count: number, req?: any) {
    await this.logActivity(
      {
        action: "list",
        details: `Listed ${count} files`,
      },
      req,
    );
  }

  async logError(error: string, details?: string, req?: any) {
    await this.logActivity(
      {
        action: "error",
        errorMessage: error,
        details,
      },
      req,
    );
  }
}

export const loggingService = new LoggingService();
