import { Router, Request, Response } from "express";
import { sseService } from "../services/sse.js";

const router = Router();

router.get("/events", (req: Request, res: Response) => {
  const folderId = (req.query.folderId as string) || null;
  const clientId = sseService.addClient(res, folderId);

  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  req.on("close", () => {
    sseService.removeClient(clientId);
  });
});

export default router;
