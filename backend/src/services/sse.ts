import { Response } from "express";

interface SSEClient {
  id: string;
  res: Response;
  folderId: string | null;
}

class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private clientIdCounter = 0;

  addClient(res: Response, folderId: string | null): string {
    const clientId = `client_${++this.clientIdCounter}_${Date.now()}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    this.clients.set(clientId, { id: clientId, res, folderId });
    console.log(
      `[SSE] Client connected: ${clientId} (folder: ${folderId || "root"})`,
    );

    return clientId;
  }

  removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      console.log(`[SSE] Client disconnected: ${clientId}`);
    }
  }

  broadcast(event: string, data: object, folderId?: string | null): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

    this.clients.forEach((client) => {
      const shouldSend =
        folderId === undefined ||
        client.folderId === folderId ||
        client.folderId === null;

      if (shouldSend) {
        try {
          client.res.write(payload);
        } catch (error) {
          console.warn(`[SSE] Failed to send to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      }
    });
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

export const sseService = new SSEService();
