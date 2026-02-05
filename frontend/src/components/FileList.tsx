import { useState } from "react";
import { FileData, deleteFile, getFullFileUrl, moveFile } from "../api/files";
import { FolderData, deleteFolder, moveFolder } from "../api/folders";
import { useNavigate } from "react-router-dom";

interface FileListProps {
  files: FileData[];
  folders?: FolderData[];
  currentPath?: string;
  currentFolderId?: string | null;
  parentFolderId?: string | null;
  onFileDeleted: (id: string) => void;
  onFolderDeleted?: (id: string) => void;
  onFolderClick?: (folderId: string) => void;
  onNavigateUp?: () => void;
  canNavigateUp?: boolean;
  onFileMoved?: (fileId: string) => void;
  onFolderMoved?: (folderId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FileList({ 
  files, 
  folders = [],
  currentPath = "/",
  currentFolderId = null,
  parentFolderId = null,
  onFileDeleted,
  onFolderDeleted,
  onFolderClick,
  onNavigateUp,
  canNavigateUp = false,
  onFileMoved,
  onFolderMoved,
}: FileListProps) {
  const navigate = useNavigate();
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'folder' | null>(null);

  const handleDeleteFile = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce fichier ?")) {
      return;
    }

    try {
      await deleteFile(id);
      onFileDeleted(id);
    } catch {
      alert("Erreur lors de la suppression du fichier");
    }
  };

  const handleDeleteFolder = async (id: string, folderName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le dossier "${folderName}" ?`)) {
      return;
    }

    try {
      await deleteFolder(id);
      if (onFolderDeleted) {
        onFolderDeleted(id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de la suppression du dossier");
    }
  };

  const handleDragStart = (e: React.DragEvent, itemId: string, itemType: 'file' | 'folder') => {
    setDraggedFileId(itemId);
    setDraggedItemType(itemType);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("itemId", itemId);
    e.dataTransfer.setData("itemType", itemType);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
    setDraggedItemType(null);
    setDragOverFolderId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    
    // Don't show drop indicator if trying to drop folder on itself
    if (draggedItemType === 'folder' && draggedFileId === folderId) {
      return;
    }
    
    e.dataTransfer.dropEffect = "move";
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemId = e.dataTransfer.getData("itemId");
    const itemType = e.dataTransfer.getData("itemType") as 'file' | 'folder';
    
    if (!itemId) {
      setDraggedFileId(null);
      setDragOverFolderId(null);
      return;
    }

    // Prevent dropping a folder into itself
    if (itemType === 'folder' && itemId === targetFolderId) {
      setDraggedFileId(null);
      setDragOverFolderId(null);
      alert("Impossible de déplacer un dossier dans lui-même");
      return;
    }

    try {
      if (itemType === 'file') {
        await moveFile(itemId, targetFolderId);
        if (onFileMoved) {
          onFileMoved(itemId);
        }
      } else if (itemType === 'folder') {
        await moveFolder(itemId, targetFolderId);
        if (onFolderMoved) {
          onFolderMoved(itemId);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors du déplacement");
    } finally {
      setDraggedFileId(null);
      setDragOverFolderId(null);
    }
  };

  const hasContent = files.length > 0 || folders.length > 0;

  if (!hasContent && !canNavigateUp) {
    return (
      <div className="card">
        <p>Aucun fichier ou dossier</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2>📂 {currentPath}</h2>
        {canNavigateUp && onNavigateUp && (
          <button 
            onClick={onNavigateUp} 
            className={`btn btn-secondary ${dragOverFolderId === 'parent' ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, 'parent')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const itemId = e.dataTransfer.getData("itemId");
              if (itemId) {
                handleDrop(e, parentFolderId);
              }
            }}
          >
            ⬆️ Dossier parent
            {dragOverFolderId === 'parent' && (
              <span style={{ marginLeft: "0.5rem" }}>📥</span>
            )}
          </button>
        )}
      </div>

      {!hasContent ? (
        <div 
          style={{ 
            padding: "2rem", 
            textAlign: "center",
            border: dragOverFolderId === 'empty' ? "2px solid #2196f3" : "2px dashed #ddd",
            borderRadius: "8px",
            backgroundColor: dragOverFolderId === 'empty' ? "#e3f2fd" : "transparent",
            transition: "all 0.2s ease"
          }}
          onDragOver={(e) => handleDragOver(e, 'empty')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, currentFolderId)}
        >
          <p>Ce dossier est vide</p>
          {draggedFileId && (
            <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "0.5rem" }}>
              📥 Déposez ici pour déplacer
            </p>
          )}
        </div>
      ) : (
        <ul className="file-list">
          {/* Display folders first */}
          {folders.map((folder) => (
            <li 
              key={`folder-${folder.id}`} 
              className={`file-item ${dragOverFolderId === folder.id ? 'drag-over' : ''} ${draggedFileId === folder.id ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, folder.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, folder.id)}
            >
              <div 
                className="file-info" 
                style={{ cursor: "pointer" }}
                onClick={() => onFolderClick && onFolderClick(folder.id)}
              >
                <div className="file-name">
                  📁 <strong>{folder.name}</strong>
                  {dragOverFolderId === folder.id && draggedFileId !== folder.id && (
                    <span style={{ marginLeft: "0.5rem", color: "#4a90e2" }}>
                      📥 Déposer ici
                    </span>
                  )}
                  {draggedFileId === folder.id && (
                    <span style={{ marginLeft: "0.5rem", color: "#999" }}>
                    </span>
                  )}
                </div>
                <div className="file-meta">
                  {folder._count ? (
                    <>
                      {folder._count.files} fichier(s) • {folder._count.children} sous-dossier(s)
                    </>
                  ) : (
                    "Dossier"
                  )}
                </div>
              </div>
              <div className="file-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onFolderClick) onFolderClick(folder.id);
                  }}
                  className="btn btn-primary"
                  style={{ marginRight: "0.5rem" }}
                >
                  Ouvrir
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id, folder.name);
                  }}
                  className="btn btn-danger"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}

          {/* Display files */}
          {files.map((file) => (
            <li 
              key={`file-${file.id}`} 
              className={`file-item ${draggedFileId === file.id ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, file.id, 'file')}
              onDragEnd={handleDragEnd}
            >
              <div className="file-info">
                <div className="file-name">
                  📄 {file.name}
                  {draggedFileId === file.id && (
                    <span style={{ marginLeft: "0.5rem", color: "#999" }}>
                    </span>
                  )}
                </div>
                <div className="file-meta">
                  {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                </div>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => navigate(`/file/${file.id}`)}
                  className="btn btn-primary"
                  style={{ marginRight: "0.5rem" }}
                >
                  Voir
                </button>
                <a
                  href={getFullFileUrl(file.url, true)}
                  download={file.name}
                  className="btn btn-secondary"
                  style={{ marginRight: "0.5rem", textDecoration: "none" }}
                >
                  Télécharger
                </a>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="btn btn-danger"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
