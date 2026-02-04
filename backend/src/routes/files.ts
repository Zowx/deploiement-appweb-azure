import { Router, Request, Response } from "express";
import multer from "multer";
import {
  mockUploadFile,
  mockGetFiles,
  mockGetFile,
  mockDeleteFile,
} from "../services/mock-storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Mode mock pour le développement local
const USE_MOCK = !process.env.AZURE_STORAGE_ACCOUNT_NAME;

if (USE_MOCK) {
  console.log("⚠️  Running in MOCK mode (no Azure/DB connection)");
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    const files = await mockGetFiles();
    res.json(files);
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const file = await mockGetFile(req.params.id);

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.json(file);
  } catch (error) {
    console.error("Error fetching file:", error);
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const { originalname, buffer, mimetype, size } = req.file;

    const file = await mockUploadFile(originalname, buffer, mimetype, size);

    res.status(201).json(file);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const file = await mockGetFile(req.params.id);

    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    await mockDeleteFile(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
