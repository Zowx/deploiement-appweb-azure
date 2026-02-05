import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
import { FileList } from "../components/FileList";
import { FolderManager } from '../components/FolderManager';
import { FileData } from "../api/files";
import { FolderData, getFolder, getRootContents } from '../api/folders';

export function HomePage() {
    const [files, setFiles] = useState<FileData[]>([]);
    const [folders, setFolders] = useState<FolderData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [currentPath, setCurrentPath] = useState<string>("/");
    const [parentFolderId, setParentFolderId] = useState<string | null>(null);

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
            setError('Erreur lors du chargement des contenus');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContents(currentFolderId);
    }, [currentFolderId]);

  const handleUploadComplete = (file: FileData) => {
    setFiles((prev) => [file, ...prev]);
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

  return (
    <div className="container">
      <div className="logs-header">
        <h1>Cloud Azure - File Manager</h1>
        <Link to="/logs" className="btn btn-secondary">
          📊 Logs FaaS
        </Link>
      </div>

            <FolderManager 
                currentFolderId={currentFolderId}
                onFolderCreated={handleFolderCreated}
                onRefresh={() => fetchContents(currentFolderId)}
            />

            <FileUpload 
                onUploadComplete={handleUploadComplete}
                currentFolderId={currentFolderId}
                currentPath={currentPath}
            />

      {error && <div className="error">{error}</div>}

            {loading ? (
                <div className='loading'>Chargement...</div>
            ) : (
                <FileList 
                    files={files} 
                    folders={folders}
                    currentPath={currentPath}
                    onFileDeleted={handleFileDeleted}
                    onFolderDeleted={handleFolderDeleted}
                    onFolderClick={handleFolderClick}
                    onNavigateUp={handleNavigateUp}
                    canNavigateUp={currentFolderId !== null}
                />
            )}
        </div>
    );
}
