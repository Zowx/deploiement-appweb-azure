import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
  saveFileLocally,
  deleteFileLocally,
  getFileLocally,
} from "../services/local-storage.js";
import {
  uploadFile as azureUploadFile,
  deleteFile as azureDeleteFile,
} from "../services/storage.js";
import {
  getAppConfig,
  isAzureStorageConfigured,
} from "../services/bootstrap.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const prisma = new PrismaClient();

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
    const files = await prisma.file.findMany();
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
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

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

// GET file by filename for download/viewing
router.get("/download/:fileName", async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const fileContent = await getFileLocally(fileName);
    
    if (!fileContent) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Find file metadata in database
    const fileMetadata = await prisma.file.findFirst({
      where: { url: { contains: fileName } },
    });

    if (!fileMetadata) {
      res.status(404).json({ error: "File metadata not found" });
      return;
    }

    // Set headers to display inline (especially for PDFs)
    res.setHeader("Content-Type", fileMetadata.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${fileMetadata.name}"`);
    res.send(fileContent);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Failed to download file" });
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

    const fileName = `${Date.now()}-${originalname}`;
    let url: string;

    if (isAzureStorageConfigured()) {
      // Azure mode: upload to Blob Storage
      url = await azureUploadFile(fileName, buffer, mimetype);
    } else {
      // Local mode: save to local storage
      url = await saveFileLocally(fileName, buffer);
    }

    // Persist to database
    const file = await prisma.file.create({
      data: {
        name: originalname,
        url,
        size,
        mimeType: mimetype,
      },
    });

    logActivity("UPLOAD_FILE", {
      id: file.id,
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
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Extract file name from URL
    const fileName = file.url.split("/").pop() || "";

    if (isAzureStorageConfigured()) {
      // Delete from Azure Blob Storage
      await azureDeleteFile(fileName);
    } else {
      // Delete from local storage
      await deleteFileLocally(fileName);
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: req.params.id },
    });

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
