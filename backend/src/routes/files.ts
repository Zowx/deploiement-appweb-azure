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
import { ensureAuthenticated } from "../services/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function getUser(req: Request): { id: string } | undefined {
  return (req as any).user;
}

function withOwnedFlag(
  file: { ownerId?: string | null; [key: string]: any },
  user: { id: string } | null | undefined,
) {
  const owned = !!(user && file.ownerId && file.ownerId === user.id);
  return { ...file, owned };
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

// GET all files (optionally filtered by folder) - returns only files owned by the user
router.get("/", async (req: Request, res: Response) => {
  try {
    const folderId = req.query.folderId as string | undefined;
    const user = getUser(req);
    // If authenticated -> return only user's private files
    // If unauthenticated -> return only public files (ownerId IS NULL)
    const where: Record<string, any> = {};
    if (user) {
      where.ownerId = user.id;
    } else {
      where.ownerId = null;
    }
    if (folderId) where.folderId = folderId;

    const files = await prisma.file.findMany({
      where,
      include: { folder: true },
    });
    loggingService.logList(files.length, req);
    res.json(files);
  } catch (error) {
    console.error("[FILES] GET / failed:", (error as Error).message);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// Helper: serve file content given metadata
async function serveFileContent(
  fileMetadata: {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    storageKey?: string | null;
    ownerId: string | null;
  },
  req: Request,
  res: Response,
) {
  // Use storageKey if available, otherwise extract from legacy URL
  const storageFileName =
    fileMetadata.storageKey || fileMetadata.url.split("/").pop() || "";

  let fileContent: Buffer | null;
  if (isAzureStorageConfigured()) {
    fileContent = await azureDownloadFile(storageFileName);
  } else {
    fileContent = await getFileLocally(storageFileName);
  }

  if (!fileContent) {
    res.status(404).json({ error: "File not found in storage" });
    return;
  }

  const forceDownload = req.query.download === "true";

  if (forceDownload) {
    loggingService.logDownload(fileMetadata.id, fileMetadata.name, req);
  } else {
    loggingService.logView(fileMetadata.id, fileMetadata.name, req);
  }

  res.setHeader("Content-Type", fileMetadata.mimeType);
  res.setHeader(
    "Content-Disposition",
    `${forceDownload ? "attachment" : "inline"}; filename="${fileMetadata.name}"`,
  );
  res.send(fileContent);
}

// GET file content by ID (secure, non-guessable)
router.get("/content/:id", async (req: Request, res: Response) => {
  try {
    const fileMetadata = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

    if (!fileMetadata) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const user = getUser(req);
    if (fileMetadata.ownerId) {
      if (!user || fileMetadata.ownerId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    await serveFileContent(fileMetadata, req, res);
  } catch (error) {
    console.error("[FILES] GET /content/:id failed:", (error as Error).message);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// Legacy: GET file by filename (kept for backward compatibility with existing DB URLs)
router.get("/download/:fileName", async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;

    const fileMetadata = await prisma.file.findFirst({
      where: { url: { endsWith: `/${fileName}` } },
    });

    if (!fileMetadata) {
      res.status(404).json({ error: "File metadata not found" });
      return;
    }

    const user = getUser(req);
    if (fileMetadata.ownerId) {
      if (!user || fileMetadata.ownerId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

    await serveFileContent(fileMetadata, req, res);
  } catch (error) {
    console.error("[FILES] GET /download failed:", (error as Error).message);
    res.status(500).json({ error: "Failed to download file" });
  }
});

// GET single file
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const user = getUser(req);
    const file = await prisma.file.findUnique({
      where: { id: req.params.id },
    });

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    if (file.ownerId) {
      if (!user || file.ownerId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    loggingService.logDownload(file.id, file.name, req);
    res.json(withOwnedFlag(file, user));
  } catch (error) {
    console.error("[FILES] GET /:id failed:", (error as Error).message);
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
    // Prevent path traversal
    const safeName = normalizedName.replace(/\.\./g, "").replace(/[\/\\]/g, "");
    const storageFileName = `${Date.now()}-${safeName}`;

    if (isAzureStorageConfigured()) {
      await azureUploadFile(storageFileName, buffer, mimetype);
    } else {
      await saveFileLocally(storageFileName, buffer);
    }

    // Persist to database - attach owner
    const user = getUser(req);
    const url = `/api/files/download/${storageFileName}`;

    const file = await prisma.file.create({
      data: {
        name: originalname,
        url,
        storageKey: storageFileName,
        size,
        mimeType: mimetype,
        folderId,
        ...(user ? { owner: { connect: { id: user.id } } } : {}),
      },
      include: { folder: true },
    });

    // Update URL to use secure ID-based endpoint
    const updatedFile = await prisma.file.update({
      where: { id: file.id },
      data: { url: `/api/files/content/${file.id}` },
      include: { folder: true },
    });

    loggingService.logUpload(updatedFile.id, originalname, size, req);
    sseService.broadcast("file:added", updatedFile, folderId);

    res.status(201).json(updatedFile);
  } catch (error) {
    const msg = (error as Error).message;
    console.error("[FILES] POST / upload failed:", msg);
    res.status(500).json({ error: "Failed to upload file", details: msg });
  }
});

// DELETE file
router.delete(
  "/:id",
  ensureAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const file = await prisma.file.findUnique({
        where: { id: req.params.id },
      });

      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const user = getUser(req);
      if (!file.ownerId || !user || file.ownerId !== user.id) {
        // Disallow deleting public files or files owned by others
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Use storageKey if available, otherwise extract from legacy URL
      const fileName = file.storageKey || file.url.split("/").pop() || "";

      // Delete from storage first — if this fails, DB record is preserved
      if (isAzureStorageConfigured()) {
        await azureDeleteFile(fileName);
      } else {
        await deleteFileLocally(fileName);
      }

      await prisma.file.delete({ where: { id: req.params.id } });

      loggingService.logDelete(file.id, file.name, req);
      sseService.broadcast("file:deleted", { id: file.id }, file.folderId);

      res.status(204).send();
    } catch (error) {
      console.error("[FILES] DELETE /:id failed:", (error as Error).message);
      res.status(500).json({ error: "Failed to delete file" });
    }
  },
);

// GET configuration info (for debugging/health check)
router.get(
  "/config/info",
  ensureAuthenticated,
  async (_req: Request, res: Response) => {
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
  },
);

// PATCH move file to another folder
router.patch(
  "/:id/move",
  ensureAuthenticated,
  async (req: Request, res: Response) => {
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

      const user = getUser(req);
      if (!file.ownerId || !user || file.ownerId !== user.id) {
        // Only real owners can move private files; public files cannot be moved by anonymous
        res.status(403).json({ error: "Forbidden" });
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
      console.error(
        "[FILES] PATCH /:id/move failed:",
        (error as Error).message,
      );
      res.status(500).json({ error: "Failed to move file" });
    }
  },
);

export default router;
