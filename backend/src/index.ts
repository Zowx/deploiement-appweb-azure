import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import filesRouter from "./routes/files.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/files", filesRouter);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
