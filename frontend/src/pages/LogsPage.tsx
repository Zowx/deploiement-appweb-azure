import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getLogs, getLogStats, LogEntry, LogStats } from "../api/logs";
import { ArrowLeft, RefreshCw } from "lucide-react";

const ACTION_LABELS: Record<
  string,
  { label: string; emoji: string; color: string }
> = {
  upload: { label: "Upload", emoji: "📤", color: "#4caf50" },
  download: { label: "Download", emoji: "📥", color: "#2196f3" },
  view: { label: "View", emoji: "👁️", color: "#9c27b0" },
  delete: { label: "Delete", emoji: "🗑️", color: "#f44336" },
  list: { label: "List", emoji: "📋", color: "#9e9e9e" },
  error: { label: "Error", emoji: "❌", color: "#d32f2f" },
};

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const [logsData, statsData] = await Promise.all([
        getLogs({
          date: selectedDate,
          action: selectedAction || undefined,
          limit: 100,
        }),
        getLogStats(selectedDate),
      ]);
      setLogs(logsData.logs);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedAction]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedDate, selectedAction]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="container">
      <div className="logs-header">
        <Link to="/" className="btn btn-secondary" title="Retour à l'accueil">
          <ArrowLeft size={16} />
        </Link>
        <h1>Logs FaaS</h1>
        <button
          className={`btn ${autoRefresh ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setAutoRefresh(!autoRefresh)}
        >
          {autoRefresh ? "⏸️ Pause" : "▶️ Auto-refresh"}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card stat-total">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          {Object.entries(ACTION_LABELS).map(
            ([action, { label, emoji, color }]) => (
              <div
                key={action}
                className="stat-card"
                style={{ borderLeftColor: color }}
                onClick={() =>
                  setSelectedAction(selectedAction === action ? "" : action)
                }
              >
                <div className="stat-value">
                  {emoji}{" "}
                  {stats.byAction[action as keyof typeof stats.byAction]}
                </div>
                <div className="stat-label">{label}</div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card filters">
        <div className="filter-row">
          <label>
            Date:
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="filter-input"
            />
          </label>
          <label>
            Action:
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="filter-input"
            >
              <option value="">Toutes</option>
              {Object.entries(ACTION_LABELS).map(([action, { label }]) => (
                <option key={action} value={action}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={fetchData} title="Rafraîchir les logs">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="error">{error}</div>}

      {/* Logs Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Chargement des logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <p>Aucun log pour cette date</p>
            <p className="hint">
              Effectuez des actions (upload, download...) pour voir les logs
            </p>
          </div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Action</th>
                <th>Fichier</th>
                <th>Taille</th>
                <th>IP</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] || {
                  label: log.action,
                  emoji: "📝",
                  color: "#666",
                };
                return (
                  <tr
                    key={log.id}
                    className={log.action === "error" ? "row-error" : ""}
                  >
                    <td className="time-cell">{formatTime(log.timestamp)}</td>
                    <td>
                      <span
                        className="action-badge"
                        style={{ backgroundColor: actionInfo.color }}
                      >
                        {actionInfo.emoji} {actionInfo.label}
                      </span>
                    </td>
                    <td className="file-cell">{log.fileName || "-"}</td>
                    <td>{formatSize(log.fileSize)}</td>
                    <td className="ip-cell">{log.userIp || "-"}</td>
                    <td className="details-cell">
                      {log.errorMessage || log.details || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
