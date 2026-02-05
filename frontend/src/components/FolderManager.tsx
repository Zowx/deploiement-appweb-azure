import { useState } from "react";
import { createFolder, FolderData } from "../api/folders";

interface FolderManagerProps {
  currentFolderId: string | null;
  onFolderCreated: (folder: FolderData) => void;
  onRefresh?: () => void;
}

export function FolderManager({
  currentFolderId,
  onFolderCreated,
  onRefresh,
}: FolderManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setError("Le nom du dossier ne peut pas être vide");
      return;
    }

    try {
      setError(null);
      const folder = await createFolder(newFolderName.trim(), currentFolderId);
      onFolderCreated(folder);
      setNewFolderName("");
      setIsCreating(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la création du dossier"
      );
    }
  };

  return (
    <div className="folder-manager">
      {!isCreating ? (
        <button
          onClick={() => setIsCreating(true)}
          className="btn btn-secondary"
          style={{ marginBottom: "1rem" }}
        >
          📁 Nouveau dossier
        </button>
      ) : (
        <form onSubmit={handleCreateFolder} style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nom du dossier"
              autoFocus
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            />
            <button type="submit" className="btn btn-primary">
              Créer
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewFolderName("");
                setError(null);
              }}
              className="btn btn-secondary"
            >
              Annuler
            </button>
          </div>
          {error && (
            <div style={{ color: "red", fontSize: "0.875rem", marginTop: "0.5rem" }}>
              {error}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
