import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import prisma from "../services/prisma.js";
import {
  saveFileLocally,
  deleteFileLocally,
  getFileLocally,
} from "../services/local-storage.js";
import {
  uploadFile as azureUploadFile,
  deleteFile as azureDeleteFile,
  downloadFileContent as azureDownloadFile,
} from "../services/storage.js";
import {
  getAppConfig,
  isAzureStorageConfigured,
} from "../services/bootstrap.js";
import { loggingService } from "../services/logging.js";
import { sseService } from "../services/sse.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

// GET all files (optionally filtered by folder)
router.get("/", async (req: Request, res: Response) => {
  try {
    const folderId = req.query.folderId as string | undefined;

    const files = await prisma.file.findMany({
      where: folderId ? { folderId } : {},
      include: {
        folder: true,
      },
    });
    loggingService.logList(files.length, req);
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

    loggingService.logDownload(file.id, file.name, req);
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

    // Find file metadata in database
    const fileMetadata = await prisma.file.findFirst({
      where: { url: { contains: fileName } },
    });

    if (!fileMetadata) {
      res.status(404).json({ error: "File metadata not found" });
      return;
    }

    // Get file content from appropriate storage
    let fileContent: Buffer | null;
    if (isAzureStorageConfigured()) {
      fileContent = await azureDownloadFile(fileName);
    } else {
      fileContent = await getFileLocally(fileName);
    }

    if (!fileContent) {
      res.status(404).json({ error: "File not found in storage" });
      return;
    }

    // Check if download is requested via query parameter
    const forceDownload = req.query.download === "true";

    // Log the action (view or download)
    if (forceDownload) {
      loggingService.logDownload(fileMetadata.id, fileMetadata.name, req);
    } else {
      loggingService.logView(fileMetadata.id, fileMetadata.name, req);
    }

    // Set headers: inline for viewing, attachment for downloading
    res.setHeader("Content-Type", fileMetadata.mimeType);
    res.setHeader(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${fileMetadata.name}"`,
    );
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
    const folderId = req.body.folderId || null;

    // Validate folder exists if specified
    if (folderId) {
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
    }

    // Validate file based on App Configuration settings
    const validation = validateFile(originalname, size);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    // Normalize filename: replace multiple spaces with single space
    const normalizedName = originalname.replace(/\s+/g, " ").trim();
    const fileName = `${Date.now()}-${normalizedName}`;
    let url: string;

    if (isAzureStorageConfigured()) {
      // Azure mode: upload to Blob Storage
      await azureUploadFile(fileName, buffer, mimetype);
      // Store relative URL to proxy through backend (avoids public access issues)
      url = `/api/files/download/${fileName}`;
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
        folderId,
      },
      include: {
        folder: true,
      },
    });

    loggingService.logUpload(file.id, originalname, size, req);
    sseService.broadcast("file:added", file, folderId);

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

    loggingService.logDelete(file.id, file.name, req);
    sseService.broadcast("file:deleted", { id: file.id }, file.folderId);

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

// PATCH move file to another folder
router.patch("/:id/move", async (req: Request, res: Response) => {
  try {
    const { folderId } = req.body;

    // Validate that file exists
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Validate that folder exists if folderId is provided
    if (folderId !== null && folderId !== undefined) {
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        res.status(404).json({ error: "Folder not found" });
        return;
      }
    }

    // Update file's folder
    const updatedFile = await prisma.file.update({
      where: { id: req.params.id },
      data: {
        folderId: folderId === null ? null : folderId,
      },
      include: {
        folder: true,
      },
    });

    loggingService.logCustom(
      "file_moved",
      {
        fileId: updatedFile.id,
        fileName: updatedFile.name,
        folderId: folderId || "root",
      },
      req,
    );
    sseService.broadcast("file:moved", {
      id: updatedFile.id,
      oldFolderId: file.folderId,
      newFolderId: folderId,
    });

    res.json(updatedFile);
  } catch (error) {
    console.error("Error moving file:", error);
    res.status(500).json({ error: "Failed to move file" });
  }
});

export default router;
