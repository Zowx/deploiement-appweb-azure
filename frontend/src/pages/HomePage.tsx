import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileUpload } from "../components/FileUpload";
import { FileList } from "../components/FileList";
import { getFiles, FileData } from "../api/files";

export function HomePage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = async () => {
    try {
      const data = await getFiles();
      setFiles(data);
      setError(null);
    } catch {
      setError("Erreur lors du chargement des fichiers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUploadComplete = (file: FileData) => {
    setFiles((prev) => [file, ...prev]);
  };

  const handleFileDeleted = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="container">
      <div className="logs-header">
        <h1>Cloud Azure - File Manager</h1>
        <Link to="/logs" className="btn btn-secondary">
          📊 Logs FaaS
        </Link>
      </div>

      <FileUpload onUploadComplete={handleUploadComplete} />

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">Chargement...</div>
      ) : (
        <FileList files={files} onFileDeleted={handleFileDeleted} />
      )}
    </div>
  );
}
