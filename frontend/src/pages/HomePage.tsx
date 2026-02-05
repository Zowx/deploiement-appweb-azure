import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
import { FileList } from "../components/FileList";
import { FolderManager } from "../components/FolderManager";
import { FileData } from "../api/files";
import { FolderData, getFolder, getRootContents } from "../api/folders";
import { useSSE } from "../api/sse";

export function HomePage() {
  const [searchParams] = useSearchParams();
  const [files, setFiles] = useState<FileData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);

  // Lire le folderId depuis l'URL au chargement
  useEffect(() => {
    const folderIdFromUrl = searchParams.get("folderId");
    if (folderIdFromUrl) {
      setCurrentFolderId(folderIdFromUrl);
    }
  }, [searchParams]);

  const fetchContents = async (folderId: string | null = null) => {
    try {
      setLoading(true);
      if (folderId) {
        const folderData = await getFolder(folderId);
        setFiles(folderData.files);
        setFolders(folderData.children);
        setCurrentPath(folderData.path);
        setParentFolderId(folderData.parentId);
      } else {
        const rootData = await getRootContents();
        setFiles(rootData.files);
        setFolders(rootData.folders);
        setCurrentPath("/");
        setParentFolderId(null);
      }
      setError(null);
    } catch {
      setError("Erreur lors du chargement des contenus");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents(currentFolderId);
  }, [currentFolderId]);

  const handleUploadComplete = (file: FileData) => {
    // Vérifier si le fichier existe déjà avant de l'ajouter
    // (le SSE peut l'avoir déjà ajouté)
    setFiles((prev) => {
      if (prev.some((f) => f.id === file.id)) {
        return prev;
      }
      return [file, ...prev];
    });
  };

  const handleFileDeleted = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFolderDeleted = (id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
  };

  const handleFolderClick = (folderId: string) => {
    setCurrentFolderId(folderId);
  };

  const handleNavigateUp = () => {
    setCurrentFolderId(parentFolderId);
  };

  const handleFolderCreated = (folder: FolderData) => {
    setFolders((prev) => [...prev, folder]);
  };

  const handleFileMoved = (fileId: string) => {
    // Remove file from current view since it was moved
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleFolderMoved = (folderId: string) => {
    // Remove folder from current view since it was moved
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  const sseHandlers = useMemo(
    () => ({
      onFileAdded: (file: FileData) => {
        setFiles((prev) => {
          if (prev.some((f) => f.id === file.id)) return prev;
          return [file, ...prev];
        });
      },
      onFileDeleted: (data: { id: string }) => {
        setFiles((prev) => prev.filter((f) => f.id !== data.id));
      },
      onFileMoved: (data: {
        id: string;
        oldFolderId: string | null;
        newFolderId: string | null;
      }) => {
        if (data.oldFolderId === currentFolderId) {
          setFiles((prev) => prev.filter((f) => f.id !== data.id));
        }
      },
      onFolderAdded: (folder: FolderData) => {
        setFolders((prev) => {
          if (prev.some((f) => f.id === folder.id)) return prev;
          return [...prev, folder];
        });
      },
      onFolderDeleted: (data: { id: string }) => {
        setFolders((prev) => prev.filter((f) => f.id !== data.id));
      },
    }),
    [currentFolderId],
  );

  useSSE(currentFolderId, sseHandlers);

  return (
    <div className="container">
      <div className="logs-header">
        <h1>Cloud Azure - File Manager</h1>
        <Link to="/logs" className="btn btn-secondary">
          📊 Logs FaaS
        </Link>
      </div>

      <FileUpload
        onUploadComplete={handleUploadComplete}
        currentFolderId={currentFolderId}
        currentPath={currentPath}
      />

      <FolderManager
        currentFolderId={currentFolderId}
        onFolderCreated={handleFolderCreated}
        onRefresh={() => fetchContents(currentFolderId)}
      />

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <FileList
          files={files}
          folders={folders}
          currentPath={currentPath}
          currentFolderId={currentFolderId}
          parentFolderId={parentFolderId}
          onFileDeleted={handleFileDeleted}
          onFolderDeleted={handleFolderDeleted}
          onFolderClick={handleFolderClick}
          onNavigateUp={handleNavigateUp}
          canNavigateUp={currentFolderId !== null}
          onFileMoved={handleFileMoved}
          onFolderMoved={handleFolderMoved}
        />
      )}
    </div>
  );
}
