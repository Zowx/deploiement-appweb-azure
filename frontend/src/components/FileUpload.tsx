import { useState, useRef } from "react";
import { uploadFile, FileData } from "../api/files";

interface FileUploadProps {
  onUploadComplete: (file: FileData) => void;
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      setError("Veuillez sélectionner un fichier");
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const uploadedFile = await uploadFile(file, setProgress);
      onUploadComplete(uploadedFile);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setError("Erreur lors de l'upload du fichier");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="card">
      <h2>Uploader un fichier</h2>
      <form className="upload-form" onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}
        <input
          type="file"
          ref={fileInputRef}
          className="file-input"
          disabled={uploading}
        />
        {uploading && (
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        <button type="submit" className="btn btn-primary" disabled={uploading}>
          {uploading ? `Upload en cours... ${progress}%` : "Uploader"}
        </button>
      </form>
    </div>
  );
}
