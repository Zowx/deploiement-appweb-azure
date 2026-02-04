import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier pour stocker les fichiers uploadés
const UPLOAD_DIR = path.join(__dirname, "../../uploads");

// Créer le dossier uploads s'il n'existe pas
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function saveFileLocally(
  fileName: string,
  content: Buffer,
): Promise<string> {
  await ensureUploadDir();
  const filePath = path.join(UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, content);
  return `/api/files/download/${fileName}`;
}

export async function deleteFileLocally(fileName: string): Promise<void> {
  const filePath = path.join(UPLOAD_DIR, fileName);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
}

export async function getFileLocally(
  fileName: string,
): Promise<Buffer | null> {
  const filePath = path.join(UPLOAD_DIR, fileName);
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export { UPLOAD_DIR };
