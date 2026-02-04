import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileData, getFiles, getFullFileUrl } from "../api/files";

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
  const isVideo = file.mimeType.startsWith("video/");
  // URLs pour visualisation et téléchargement
  const viewUrl = getFullFileUrl(file.url, false);
  const downloadUrl = getFullFileUrl(file.url, true);

  return (
    <div className="container">
      <div className="file-viewer-header">
        <button onClick={() => navigate("/")} className="btn btn-primary">
          ← Retour
        </button>
        <h2>{file.name}</h2>
        <a
          href={downloadUrl}
          download={file.name}
          className="btn btn-primary"
        >
          Télécharger
        </a>
      </div>

      <div className="file-viewer-content">
        {isPDF && (
          <iframe
            src={viewUrl}
            title={file.name}
            className="pdf-viewer"
            width="100%"
            height="800px"
          />
        )}
        {isImage && (
          <img
            src={viewUrl}
            alt={file.name}
            className="image-viewer"
          />
        )}
        {isVideo && (
          <video
            src={viewUrl}
            controls
            className="video-viewer"
          >
            Votre navigateur ne supporte pas la lecture de vidéos.
          </video>
        )}
        {!isPDF && !isImage && !isVideo && (
          <div className="unsupported-file">
            <p>Aperçu non disponible pour ce type de fichier.</p>
            <a
              href={downloadUrl}
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
