import { FileData, deleteFile, getFullFileUrl } from "../api/files";
import { FolderData, deleteFolder } from "../api/folders";
import { useNavigate } from "react-router-dom";

interface FileListProps {
  files: FileData[];
  folders?: FolderData[];
  currentPath?: string;
  onFileDeleted: (id: string) => void;
  onFolderDeleted?: (id: string) => void;
  onFolderClick?: (folderId: string) => void;
  onNavigateUp?: () => void;
  canNavigateUp?: boolean;
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
  onFileDeleted,
  onFolderDeleted,
  onFolderClick,
  onNavigateUp,
  canNavigateUp = false,
}: FileListProps) {
  const navigate = useNavigate();

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
          <button onClick={onNavigateUp} className="btn btn-secondary">
            ⬆️ Dossier parent
          </button>
        )}
      </div>

      {!hasContent ? (
        <p>Ce dossier est vide</p>
      ) : (
        <ul className="file-list">
          {/* Display folders first */}
          {folders.map((folder) => (
            <li key={`folder-${folder.id}`} className="file-item">
              <div 
                className="file-info" 
                style={{ cursor: "pointer" }}
                onClick={() => onFolderClick && onFolderClick(folder.id)}
              >
                <div className="file-name">
                  📁 <strong>{folder.name}</strong>
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
            <li key={`file-${file.id}`} className="file-item">
              <div className="file-info">
                <div className="file-name">📄 {file.name}</div>
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
