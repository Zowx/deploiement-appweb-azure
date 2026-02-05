export interface FolderData {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
    children: number;
  };
}

export interface FolderContents {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  files: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: string;
  }>;
  children: FolderData[];
  parent: FolderData | null;
}

export interface RootContents {
  files: Array<{
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: string;
  }>;
  folders: FolderData[];
  path: string;
}

const API_URL = import.meta.env.VITE_API_URL || "/api/files";
const FOLDERS_API_URL = API_URL.replace("/files", "/folders");

export async function getFolders(): Promise<FolderData[]> {
  const response = await fetch(FOLDERS_API_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch folders");
  }
  return response.json();
}

export async function getFolder(id: string): Promise<FolderContents> {
  const response = await fetch(`${FOLDERS_API_URL}/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch folder");
  }
  return response.json();
}

export async function getFolderByPath(path: string): Promise<FolderContents> {
  const encodedPath = encodeURIComponent(path.replace(/^\//, ""));
  const response = await fetch(`${FOLDERS_API_URL}/path/${encodedPath}`);
  if (!response.ok) {
    throw new Error("Failed to fetch folder");
  }
  return response.json();
}

export async function getRootContents(): Promise<RootContents> {
  const response = await fetch(`${FOLDERS_API_URL}/root/contents`);
  if (!response.ok) {
    throw new Error("Failed to fetch root contents");
  }
  return response.json();
}

export async function createFolder(
  name: string,
  parentId: string | null = null,
): Promise<FolderData> {
  const response = await fetch(FOLDERS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, parentId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create folder");
  }

  return response.json();
}

export async function deleteFolder(id: string): Promise<void> {
  const response = await fetch(`${FOLDERS_API_URL}/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete folder");
  }
}

export async function renameFolder(
  id: string,
  name: string,
): Promise<FolderData> {
  const response = await fetch(`${FOLDERS_API_URL}/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to rename folder");
  }

  return response.json();
}

export async function moveFolder(
  folderId: string,
  parentId: string | null
): Promise<FolderData> {
  const response = await fetch(`${FOLDERS_API_URL}/${folderId}/move`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ parentId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to move folder");
  }

  return response.json();
}
