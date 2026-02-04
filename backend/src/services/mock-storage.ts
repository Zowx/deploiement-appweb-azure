// Mock storage pour le développement local
const files: Map<
  string,
  { name: string; url: string; size: number; mimeType: string; createdAt: Date }
> = new Map();

let idCounter = 1;

export function generateId(): string {
  return `file_${idCounter++}`;
}

export async function mockUploadFile(
  fileName: string,
  _content: Buffer,
  contentType: string,
  size: number,
): Promise<{
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}> {
  const id = generateId();
  const file = {
    id,
    name: fileName,
    url: `/mock-files/${fileName}`,
    size,
    mimeType: contentType,
    createdAt: new Date(),
  };
  files.set(id, file);
  return { ...file, id };
}

export async function mockGetFiles() {
  return Array.from(files.entries()).map(([id, file]) => ({
    id,
    ...file,
    updatedAt: file.createdAt,
  }));
}

export async function mockGetFile(id: string) {
  const file = files.get(id);
  if (!file) return null;
  return { id, ...file, updatedAt: file.createdAt };
}

export async function mockDeleteFile(id: string): Promise<boolean> {
  return files.delete(id);
}
