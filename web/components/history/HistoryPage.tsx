import React, { useEffect, useState } from "react";

interface RenderEntry {
  jobId: string;
  filename: string;
  downloadUrl: string;
  createdAt: number;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString();
}

export const HistoryPage: React.FC = () => {
  const [renders, setRenders] = useState<RenderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    setDeleting(filename);
    try {
      const res = await fetch(`/api/render/delete-file/${filename}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setRenders(prev => prev.filter(r => r.filename !== filename));
    } catch (e) {
      alert(String(e));
    } finally {
      setDeleting(null);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/renders");
      if (!res.ok) throw new Error("Failed to load renders");
      setRenders(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Rendered Videos
          </h2>
          <button
            onClick={load}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 13,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* States */}
        {loading && (
          <p style={{ color: "var(--text-tertiary)", fontSize: 14 }}>Loading…</p>
        )}

        {error && (
          <p style={{ color: "#ef4444", fontSize: 14 }}>{error}</p>
        )}

        {!loading && !error && renders.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "60px 0",
            color: "var(--text-tertiary)",
            fontSize: 14,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
            No renders yet. Go to Generator to create one.
          </div>
        )}

        {/* Render list */}
        {!loading && renders.map((r) => (
          <div
            key={r.jobId}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
                {r.filename}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {formatDate(r.createdAt)} · {formatSize(r.size)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a
                href={r.downloadUrl}
                download={r.filename}
                style={{
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Download
              </a>
              <button
                onClick={() => handleDelete(r.filename)}
                disabled={deleting === r.filename}
                style={{
                  background: deleting === r.filename ? "#555" : "#3b1a1a",
                  color: "#ef4444",
                  border: "1px solid #5a2020",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: deleting === r.filename ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {deleting === r.filename ? "…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
