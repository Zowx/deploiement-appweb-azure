import { FileData, deleteFile } from "../api/files";

interface FileListProps {
  files: FileData[];
  onFileDeleted: (id: string) => void;
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

export function FileList({ files, onFileDeleted }: FileListProps) {
  const handleDelete = async (id: string) => {
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

  if (files.length === 0) {
    return (
      <div className="card">
        <p>Aucun fichier uploadé</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Fichiers uploadés</h2>
      <ul className="file-list">
        {files.map((file) => (
          <li key={file.id} className="file-item">
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-meta">
                {formatFileSize(file.size)} • {formatDate(file.createdAt)}
              </div>
            </div>
            <div className="file-actions">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ marginRight: "0.5rem" }}
              >
                Voir
              </a>
              <button
                onClick={() => handleDelete(file.id)}
                className="btn btn-danger"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
