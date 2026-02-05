import { Router, Request, Response } from "express";
import prisma from "../services/prisma.js";
import { loggingService } from "../services/logging.js";
import { sseService } from "../services/sse.js";

const router = Router();

// GET all folders
router.get("/", async (_req: Request, res: Response) => {
  try {
    const folders = await prisma.folder.findMany({
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
      orderBy: {
        path: "asc",
      },
    });
    res.json(folders);
  } catch (error) {
    console.error("Error fetching folders:", error);
    res.status(500).json({ error: "Failed to fetch folders" });
  }
});

// GET folder by ID with contents
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        files: true,
        children: {
          include: {
            _count: {
              select: {
                files: true,
                children: true,
              },
            },
          },
        },
        parent: true,
      },
    });

    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    res.json(folder);
  } catch (error) {
    console.error("Error fetching folder:", error);
    res.status(500).json({ error: "Failed to fetch folder" });
  }
});

// GET folder contents (files and subfolders) by path
router.get("/path/*", async (req: Request, res: Response) => {
  try {
    // Extract the path from the URL (everything after /path/)
    const folderPath = "/" + (req.params[0] || "").replace(/\/$/, "");

    const folder = await prisma.folder.findUnique({
      where: { path: folderPath },
      include: {
        files: {
          orderBy: {
            name: "asc",
          },
        },
        children: {
          include: {
            _count: {
              select: {
                files: true,
                children: true,
              },
            },
          },
          orderBy: {
            name: "asc",
          },
        },
        parent: true,
      },
    });

    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    res.json(folder);
  } catch (error) {
    console.error("Error fetching folder by path:", error);
    res.status(500).json({ error: "Failed to fetch folder" });
  }
});

// GET root contents (files and folders at root level)
router.get("/root/contents", async (_req: Request, res: Response) => {
  try {
    const [rootFiles, rootFolders] = await Promise.all([
      prisma.file.findMany({
        where: {
          folderId: null,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.folder.findMany({
        where: {
          parentId: null,
        },
        include: {
          _count: {
            select: {
              files: true,
              children: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    res.json({
      files: rootFiles,
      folders: rootFolders,
      path: "/",
    });
  } catch (error) {
    console.error("Error fetching root contents:", error);
    res.status(500).json({ error: "Failed to fetch root contents" });
  }
});

// POST create new folder
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, parentId } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    // Validate folder name (no special characters)
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
      res.status(400).json({
        error:
          "Folder name can only contain letters, numbers, spaces, hyphens and underscores",
      });
      return;
    }

    let path = "/" + name.trim();
    let parent = null;

    if (parentId) {
      parent = await prisma.folder.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        res.status(404).json({ error: "Parent folder not found" });
        return;
      }

      path = parent.path + "/" + name.trim();
    }

    // Check if folder with same path already exists
    const existingFolder = await prisma.folder.findUnique({
      where: { path },
    });

    if (existingFolder) {
      res.status(409).json({
        error: "A folder with this name already exists in this location",
      });
      return;
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        path,
        parentId: parentId || null,
      },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    loggingService.logCustom(
      "folder_created",
      { folderId: folder.id, folderName: folder.name, path: folder.path },
      req,
    );
    sseService.broadcast("folder:added", folder, parentId || null);

    res.status(201).json(folder);
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

// DELETE folder
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    // Check if folder has contents
    if (folder._count.files > 0 || folder._count.children > 0) {
      res.status(400).json({
        error:
          "Cannot delete folder with contents. Please delete all files and subfolders first.",
      });
      return;
    }

    await prisma.folder.delete({
      where: { id: req.params.id },
    });

    loggingService.logCustom(
      "folder_deleted",
      { folderId: folder.id, folderName: folder.name },
      req,
    );
    sseService.broadcast("folder:deleted", { id: folder.id }, folder.parentId);

    res.json({ message: "Folder deleted successfully" });
  } catch (error) {
    console.error("Error deleting folder:", error);
    res.status(500).json({ error: "Failed to delete folder" });
  }
});

// PATCH rename folder
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "Folder name is required" });
      return;
    }

    // Validate folder name
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
      res.status(400).json({
        error:
          "Folder name can only contain letters, numbers, spaces, hyphens and underscores",
      });
      return;
    }

    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    const newPath = folder.parent
      ? folder.parent.path + "/" + name.trim()
      : "/" + name.trim();

    // Check if new path already exists
    if (newPath !== folder.path) {
      const existingFolder = await prisma.folder.findUnique({
        where: { path: newPath },
      });

      if (existingFolder) {
        res.status(409).json({
          error: "A folder with this name already exists in this location",
        });
        return;
      }
    }

    // Update folder and all children paths (cascade)
    const oldPath = folder.path;
    const updatedFolder = await prisma.folder.update({
      where: { id: req.params.id },
      data: {
        name: name.trim(),
        path: newPath,
      },
    });

    // Update all children paths
    if (folder.children.length > 0) {
      const allDescendants = await prisma.folder.findMany({
        where: {
          path: {
            startsWith: oldPath + "/",
          },
        },
      });

      for (const descendant of allDescendants) {
        const newDescendantPath = descendant.path.replace(oldPath, newPath);
        await prisma.folder.update({
          where: { id: descendant.id },
          data: { path: newDescendantPath },
        });
      }
    }

    loggingService.logCustom(
      "folder_renamed",
      {
        folderId: updatedFolder.id,
        oldName: folder.name,
        newName: updatedFolder.name,
      },
      req,
    );

    res.json(updatedFolder);
  } catch (error) {
    console.error("Error renaming folder:", error);
    res.status(500).json({ error: "Failed to rename folder" });
  }
});

// PATCH move folder to another parent folder
router.patch("/:id/move", async (req: Request, res: Response) => {
  try {
    const { parentId } = req.body;

    const folder = await prisma.folder.findUnique({
      where: { id: req.params.id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!folder) {
      res.status(404).json({ error: "Folder not found" });
      return;
    }

    // Validate new parent folder exists if parentId is provided
    let newParent = null;
    if (parentId !== null && parentId !== undefined) {
      newParent = await prisma.folder.findUnique({
        where: { id: parentId },
      });

      if (!newParent) {
        res.status(404).json({ error: "Target folder not found" });
        return;
      }

      // Prevent moving a folder into itself or its own descendants
      if (
        newParent.path.startsWith(folder.path + "/") ||
        newParent.id === folder.id
      ) {
        res.status(400).json({
          error: "Cannot move a folder into itself or its descendants",
        });
        return;
      }
    }

    // Calculate new path
    const newPath = newParent
      ? newParent.path + "/" + folder.name
      : "/" + folder.name;

    // Check if a folder with same name already exists at destination
    const existingFolder = await prisma.folder.findUnique({
      where: { path: newPath },
    });

    if (existingFolder && existingFolder.id !== folder.id) {
      res.status(409).json({
        error: "A folder with this name already exists in the destination",
      });
      return;
    }

    // Update folder and all children paths
    const oldPath = folder.path;
    const updatedFolder = await prisma.folder.update({
      where: { id: req.params.id },
      data: {
        parentId: parentId === null ? null : parentId,
        path: newPath,
      },
      include: {
        parent: true,
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    // Update all descendants paths
    const allDescendants = await prisma.folder.findMany({
      where: {
        path: {
          startsWith: oldPath + "/",
        },
      },
    });

    for (const descendant of allDescendants) {
      const newDescendantPath = descendant.path.replace(oldPath, newPath);
      await prisma.folder.update({
        where: { id: descendant.id },
        data: { path: newDescendantPath },
      });
    }

    loggingService.logCustom(
      "folder_moved",
      {
        folderId: updatedFolder.id,
        folderName: updatedFolder.name,
        parentId: parentId || "root",
      },
      req,
    );

    res.json(updatedFolder);
  } catch (error) {
    console.error("Error moving folder:", error);
    res.status(500).json({ error: "Failed to move folder" });
  }
});

export default router;
