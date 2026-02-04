export interface FileData {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

const API_URL = import.meta.env.VITE_API_URL || "/api/files";

// Get the base URL for the API (handles both dev and production)
function getApiBaseUrl(): string {
  // In production, use the same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  // In development, use the backend URL or default to localhost:3001
  return import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
}

// Convert relative file URL to absolute URL
export function getFullFileUrl(fileUrl: string, download: boolean = false): string {
  if (fileUrl.startsWith('http')) {
    return download ? `${fileUrl}?download=true` : fileUrl;
  }
  const fullUrl = `${getApiBaseUrl()}${fileUrl}`;
  return download ? `${fullUrl}?download=true` : fullUrl;
}

export async function getFiles(): Promise<FileData[]> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch files");
  }
  return response.json();
}

export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<FileData> {
  
  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error("Upload failed"));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    xhr.open("POST", API_URL);
    xhr.send(formData);
  });
}

export async function deleteFile(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete file");
  }
}

export async function downloadFile(file: FileData): Promise<void> {
  try {
    // Create a temporary link to trigger download
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    throw new Error("Failed to download file");
  }
}
