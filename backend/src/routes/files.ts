import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import {
  mockUploadFile,
  mockGetFiles,
  mockGetFile,
  mockDeleteFile,
} from "../services/mock-storage.js";
import {
  uploadFile as azureUploadFile,
  deleteFile as azureDeleteFile,
  listFiles as azureListFiles,
  getFileUrl,
} from "../services/storage.js";
import {
  getAppConfig,
  isAzureStorageConfigured,
} from "../services/bootstrap.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// In-memory file tracking for Azure Storage (simple approach)
const fileRegistry: Map<
  string,
  {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
    createdAt: Date;
  }
> = new Map();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function validateFile(
  filename: string,
  size: number,
): { valid: boolean; error?: string } {
  const config = getAppConfig();

  if (!config.featureFileValidationEnabled) {
    return { valid: true };
  }

  // Check file size
  const maxSizeBytes = config.uploadMaxFileSizeMB * 1024 * 1024;
  if (size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${config.uploadMaxFileSizeMB}MB`,
    };
  }

  // Check file extension
  const ext = path.extname(filename).toLowerCase();
  if (!config.uploadAllowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${config.uploadAllowedExtensions.join(", ")}`,
    };
  }

  return { valid: true };
}

function logActivity(action: string, details: Record<string, unknown>): void {
  const config = getAppConfig();
  if (config.featureLoggingEnabled) {
    console.log(`[${new Date().toISOString()}] ${action}:`, details);
  }
}

// GET all files
router.get("/", async (_req: Request, res: Response) => {
  try {
    if (!isAzureStorageConfigured()) {
      const files = await mockGetFiles();
      res.json(files);
      return;
    }

    // Azure mode: return from registry
    const files = Array.from(fileRegistry.values());
    logActivity("LIST_FILES", { count: files.length });
    res.json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// GET single file
router.get("/:id", async (req: Request, res: Response) => {
  try {
    if (!isAzureStorageConfigured()) {
      const file = await mockGetFile(req.params.id);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      res.json(file);
      return;
    }

    // Azure mode
    const file = fileRegistry.get(req.params.id);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    logActivity("GET_FILE", { id: req.params.id, name: file.name });
    res.json(file);
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

// POST upload file
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { originalname, buffer, mimetype, size } = req.file;

    // Validate file based on App Configuration settings
    const validation = validateFile(originalname, size);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    if (!isAzureStorageConfigured()) {
      const file = await mockUploadFile(originalname, buffer, mimetype, size);
      res.status(201).json(file);
      return;
    }

    // Azure mode: upload to Blob Storage
    const id = generateId();
    const blobName = `${id}-${originalname}`;
    const url = await azureUploadFile(blobName, buffer, mimetype);

    const file = {
      id,
      name: originalname,
      url,
      size,
      mimeType: mimetype,
      createdAt: new Date(),
    };

    fileRegistry.set(id, file);

    logActivity("UPLOAD_FILE", {
      id,
      name: originalname,
      size,
      mimeType: mimetype,
    });

    res.status(201).json(file);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

// DELETE file
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    if (!isAzureStorageConfigured()) {
      const file = await mockGetFile(req.params.id);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      await mockDeleteFile(req.params.id);
      res.status(204).send();
      return;
    }

    // Azure mode
    const file = fileRegistry.get(req.params.id);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Extract blob name from URL
    const blobName = `${file.id}-${file.name}`;
    await azureDeleteFile(blobName);
    fileRegistry.delete(req.params.id);

    logActivity("DELETE_FILE", { id: req.params.id, name: file.name });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// GET configuration info (for debugging/health check)
router.get("/config/info", async (_req: Request, res: Response) => {
  try {
    const config = getAppConfig();
    res.json({
      appName: config.appName,
      environment: config.environment,
      apiVersion: config.apiVersion,
      uploadMaxFileSizeMB: config.uploadMaxFileSizeMB,
      uploadAllowedExtensions: config.uploadAllowedExtensions,
      features: {
        logging: config.featureLoggingEnabled,
        fileValidation: config.featureFileValidationEnabled,
      },
      azureStorageConfigured: isAzureStorageConfigured(),
    });
  } catch (error) {
    res.status(500).json({ error: "Configuration not loaded" });
  }
});

export default router;
