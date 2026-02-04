import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileData, getFiles } from "../api/files";

export function FileViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const files = await getFiles();
        const foundFile = files.find((f) => f.id === id);
        if (foundFile) {
          setFile(foundFile);
        }
      } catch (error) {
        console.error("Error fetching file:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [id]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Chargement du fichier...</div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="container">
        <div className="error">Fichier non trouvé</div>
        <button onClick={() => navigate("/")} className="btn btn-primary">
          Retour à la liste
        </button>
      </div>
    );
  }

  const isPDF = file.mimeType === "application/pdf";
  const isImage = file.mimeType.startsWith("image/");
  
  // Construire l'URL complète pour le backend
  const fileUrl = file.url.startsWith('http') 
    ? file.url 
    : `http://localhost:3001${file.url}`;

  return (
    <div className="container">
      <div className="file-viewer-header">
        <button onClick={() => navigate("/")} className="btn btn-primary">
          ← Retour
        </button>
        <h2>{file.name}</h2>
        <a
          href={fileUrl}
          download={file.name}
          className="btn btn-primary"
        >
          Télécharger
        </a>
      </div>

      <div className="file-viewer-content">
        {isPDF && (
          <iframe
            src={fileUrl}
            title={file.name}
            className="pdf-viewer"
            width="100%"
            height="800px"
          />
        )}
        {isImage && (
          <img
            src={fileUrl}
            alt={file.name}
            className="image-viewer"
          />
        )}
        {!isPDF && !isImage && (
          <div className="unsupported-file">
            <p>Aperçu non disponible pour ce type de fichier.</p>
            <a
              href={fileUrl}
              download={file.name}
              className="btn btn-primary"
            >
              Télécharger le fichier
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
