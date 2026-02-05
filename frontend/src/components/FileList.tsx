import { FileData, deleteFile, getFullFileUrl, moveFile } from "../api/files";
import { FolderData, deleteFolder, moveFolder } from "../api/folders";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, Eye, Download, Trash2, FolderOpen } from "lucide-react";
import { useFileFilters } from "../hooks/useFileFilters";
import { FolderManager } from "./FolderManager";

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
  onFolderCreated?: (folder: FolderData) => void;
  onRefresh?: () => void;
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
  onFolderCreated,
  onRefresh,
}: FileListProps) {
  const navigate = useNavigate();
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'folder' | null>(null);
  const {
    searchTerm,
    sortKey,
    sortOrder,
    setSearchTerm,
    setSortKey,
    toggleSortOrder,
    filteredAndSortedFiles,
  } = useFileFilters();
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSortDropdownOpen && !(event.target as Element).closest('.sort-dropdown')) {
        setIsSortDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortDropdownOpen]);

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

  const sortedFiles = filteredAndSortedFiles(files);

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

  if (sortedFiles.length === 0 && searchTerm.trim()) {
    return (
      <div className="card">
        <h2>Fichiers uploadés</h2>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", marginTop: "1rem" }}>
          <div className="sort-dropdown" style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: "1rem" }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                padding: "0.5rem 0.75rem 0.5rem 2.25rem", 
                borderRadius: "4px", 
                border: "1px solid #ccc",
                minWidth: "250px",
                width: "300px",
                fontSize: "0.8rem"
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontWeight: 600 }}>Trier par:</label>
            <div className="sort-dropdown" style={{ position: "relative" }}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  minWidth: "100px"
                }}
              >
                {sortKey === "createdAt" && "📅"}
                {sortKey === "name" && "📄"}
                {sortKey === "size" && "💾"}
                <span>
                  {sortKey === "createdAt" && "Date"}
                  {sortKey === "name" && "Nom"}
                  {sortKey === "size" && "Taille"}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.8em" }}>▼</span>
              </button>
              {isSortDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    zIndex: 1000,
                    marginTop: "2px"
                  }}
                >
                  <button
                    onClick={() => {
                      setSortKey("createdAt");
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left"
                    }}
                  >
                    📅
                    <span>Date</span>
                  </button>
                  <button
                    onClick={() => {
                      setSortKey("name");
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left"
                    }}
                  >
                    📄
                    <span>Nom</span>
                  </button>
                  <button
                    onClick={() => {
                      setSortKey("size");
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left"
                    }}
                  >
                    💾
                    <span>Taille</span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={toggleSortOrder}
              style={{ 
                padding: "0.25rem 0.5rem", 
                borderRadius: "4px", 
                border: "1px solid #ccc",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontSize: "1.2em",
                lineHeight: 1,
                color: "#333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8f9fa";
                e.currentTarget.style.borderColor = "#adb5bd";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#ccc";
              }}
              title={sortOrder === "asc" ? "Tri ascendant" : "Tri descendant"}
            >
              {sortOrder === "asc" ? <ArrowUp size={20} color="#2563eb" /> : <ArrowDown size={20} color="#2563eb" />}
            </button>
          </div>
        </div>
        <p>Aucun fichier ne correspond à votre recherche "{searchTerm}"</p>
      </div>
    );
  }

  if (sortedFiles.length === 0 && searchTerm.trim()) {
    return (
      <div className="card">
        <h2>Fichiers uploadés</h2>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", marginTop: "1rem" }}>
          <div className="sort-dropdown" style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: "1rem" }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                padding: "0.5rem 0.75rem 0.5rem 2.25rem", 
                borderRadius: "4px", 
                border: "1px solid #ccc",
                minWidth: "250px",
                width: "300px",
                fontSize: "0.8rem"
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label style={{ fontWeight: 600 }}>Trier par:</label>
            <div className="sort-dropdown" style={{ position: "relative" }}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  minWidth: "100px"
                }}
              >
                {sortKey === "createdAt" && "📅"}
                {sortKey === "name" && "📄"}
                {sortKey === "size" && "💾"}
                <span>
                  {sortKey === "createdAt" && "Date"}
                  {sortKey === "name" && "Nom"}
                  {sortKey === "size" && "Taille"}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "0.8em" }}>▼</span>
              </button>
              {isSortDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    backgroundColor: "#ffffff",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    zIndex: 1000,
                    marginTop: "2px"
                  }}
                >
                  <button
                    onClick={() => {
                      setSortKey("createdAt");
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left"
                    }}
                  >
                    📅
                    <span>Date</span>
                  </button>
                  <button
                    onClick={() => {
                      setSortKey("name");
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left"
                    }}
                  >
                    📄
                    <span>Nom</span>
                  </button>
                  <button
                    onClick={() => {
                      setSortKey("size");
                      setIsSortDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      textAlign: "left"
                    }}
                  >
                    💾
                    <span>Taille</span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="btn btn-secondary"
              onClick={toggleSortOrder}
              style={{ 
                padding: "0.25rem 0.5rem", 
                borderRadius: "4px", 
                border: "1px solid #ccc",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                transition: "all 0.2s ease",
                fontSize: "1.2em",
                lineHeight: 1,
                color: "#333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8f9fa";
                e.currentTarget.style.borderColor = "#adb5bd";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#ccc";
              }}
              title={sortOrder === "asc" ? "Tri ascendant" : "Tri descendant"}
            >
              {sortOrder === "asc" ? <ArrowUp size={20} color="#2563eb" /> : <ArrowDown size={20} color="#2563eb" />}
            </button>
          </div>
        </div>
        <p>Aucun fichier ne correspond à votre recherche "{searchTerm}"</p>
      </div>
    );
  }

  return (
    <div className="card">
      {canNavigateUp && onNavigateUp && (
        <div style={{ marginBottom: "1rem" }}>
          <button 
            onClick={onNavigateUp} 
            className={`btn btn-secondary ${dragOverFolderId === 'parent' ? 'drag-over' : ''}`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '1.5rem', 
              width: '3rem', 
              height: '3rem', 
              padding: '0.5rem',
              backgroundColor: '#ffffff',
            }}
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
            title="Dossier parent"
          >
            ⬅️
          </button>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2>📂 {currentPath}</h2>
        {onFolderCreated && onRefresh && (
          <FolderManager
            currentFolderId={currentFolderId}
            onFolderCreated={onFolderCreated}
            onRefresh={onRefresh}
          />
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
        <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", marginTop: "1rem" }}>
        <div className="sort-dropdown" style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: "0.5rem", top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: "1rem" }}>🔍</span>
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              padding: "0.5rem 0.75rem 0.5rem 2.25rem", 
              borderRadius: "4px", 
              border: "1px solid #ccc",
              minWidth: "250px",
              width: "300px",
              fontSize: "0.9rem"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label style={{ fontWeight: 600 }}>Trier par:</label>
          <div className="sort-dropdown" style={{ position: "relative" }}>
            <button
              onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                border: "1px solid #ccc",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                minWidth: "100px"
              }}
            >
              {sortKey === "createdAt" && "📅"}
              {sortKey === "name" && "📄"}
              {sortKey === "size" && "💾"}
              <span>
                {sortKey === "createdAt" && "Date"}
                {sortKey === "name" && "Nom"}
                {sortKey === "size" && "Taille"}
              </span>
              <span style={{ marginLeft: "auto", fontSize: "0.8em" }}>▼</span>
            </button>
            {isSortDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "#ffffff",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  zIndex: 1000,
                  marginTop: "2px"
                }}
              >
                <button
                  onClick={() => {
                    setSortKey("createdAt");
                    setIsSortDropdownOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    textAlign: "left"
                  }}
                >
                  📅
                  <span>Date</span>
                </button>
                <button
                  onClick={() => {
                    setSortKey("name");
                    setIsSortDropdownOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    textAlign: "left"
                  }}
                >
                  📄
                  <span>Nom</span>
                </button>
                <button
                  onClick={() => {
                    setSortKey("size");
                    setIsSortDropdownOpen(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.5rem",
                    border: "none",
                    backgroundColor: "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    textAlign: "left"
                  }}
                >
                  💾
                  <span>Taille</span>
                </button>
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary"
            onClick={toggleSortOrder}
            style={{ 
              padding: "0.25rem 0.5rem", 
              borderRadius: "4px", 
              border: "1px solid #ccc",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              transition: "all 0.2s ease",
              fontSize: "1.2em",
              lineHeight: 1,
              color: "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f8f9fa";
              e.currentTarget.style.borderColor = "#adb5bd";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#ccc";
            }}
            title={sortOrder === "asc" ? "Tri ascendant" : "Tri descendant"}
          >
            {sortOrder === "asc" ? <ArrowUp size={20} color="#000000" /> : <ArrowDown size={20} color="#000000" />}
          </button>
        </div>
      </div>

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
                  style={{ marginRight: "0.5rem", padding: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Ouvrir le dossier"
                >
                  <FolderOpen size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id, folder.name);
                  }}
                  className="btn btn-danger"
                  style={{ padding: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Supprimer le dossier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}

          {/* Display files */}
          {sortedFiles.map((file) => (
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
                  style={{ marginRight: "0.5rem", padding: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Voir le fichier"
              >
                  <Eye size={16} />
                </button>
                <a
                  href={getFullFileUrl(file.url, true)}
                  download={file.name}
                  className="btn btn-secondary"
                  style={{ marginRight: "0.5rem", textDecoration: "none", padding: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="Télécharger le fichier"
              >
                  <Download size={16} />
                </a>
                <button
                  onClick={() => handleDeleteFile(file.id)}
                  className="btn btn-danger"
                  style={{ padding: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Supprimer le fichier"
              >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
