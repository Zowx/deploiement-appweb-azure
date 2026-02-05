import { useEffect, useRef, useCallback } from "react";
import { FileData } from "./files";
import { FolderData } from "./folders";

type SSEEventHandlers = {
  onFileAdded?: (file: FileData) => void;
  onFileDeleted?: (data: { id: string }) => void;
  onFileMoved?: (data: {
    id: string;
    oldFolderId: string | null;
    newFolderId: string | null;
  }) => void;
  onFolderAdded?: (folder: FolderData) => void;
  onFolderDeleted?: (data: { id: string }) => void;
};

export function useSSE(folderId: string | null, handlers: SSEEventHandlers) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    const baseUrl =
      import.meta.env.VITE_API_URL?.replace("/api/files", "") || "";
    const url = folderId
      ? `${baseUrl}/api/events?folderId=${folderId}`
      : `${baseUrl}/api/events`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("file:added", (event) => {
      const file = JSON.parse(event.data) as FileData;
      handlersRef.current.onFileAdded?.(file);
    });

    eventSource.addEventListener("file:deleted", (event) => {
      const data = JSON.parse(event.data) as { id: string };
      handlersRef.current.onFileDeleted?.(data);
    });

    eventSource.addEventListener("file:moved", (event) => {
      const data = JSON.parse(event.data);
      handlersRef.current.onFileMoved?.(data);
    });

    eventSource.addEventListener("folder:added", (event) => {
      const folder = JSON.parse(event.data) as FolderData;
      handlersRef.current.onFolderAdded?.(folder);
    });

    eventSource.addEventListener("folder:deleted", (event) => {
      const data = JSON.parse(event.data) as { id: string };
      handlersRef.current.onFolderDeleted?.(data);
    });

    eventSource.addEventListener("connected", () => {
      console.log("[SSE] Connected to server");
    });

    eventSource.onerror = () => {
      console.warn("[SSE] Connection error, reconnecting...");
    };

    return eventSource;
  }, [folderId]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [connect]);
}
