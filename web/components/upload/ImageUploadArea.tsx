import React, { useRef, useState, useCallback } from "react";
import { useGeneratorStore } from "../../store/generatorStore";

export const ImageUploadArea: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState("");

  const { imageUrl, setImageFromFile, setImageFromUrl } = useGeneratorStore();
  const hasImage = imageUrl.length > 0;

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFromFile(file);
    }
  }, [setImageFromFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const onUrlCommit = () => {
    if (urlValue.trim()) setImageFromUrl(urlValue.trim());
  };

  return (
    <div>
      {/* Toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {["Upload File", "Paste URL"].map((label, i) => {
          const active = urlMode === (i === 1);
          return (
            <button
              key={label}
              onClick={() => { setUrlMode(i === 1); }}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: "var(--radius-sm)",
                border: active ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
                background: active ? "var(--accent-light)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: 12,
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {urlMode ? (
        /* URL input */
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="url"
            placeholder="https://example.com/image.png"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onUrlCommit()}
            style={{
              flex: 1,
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--border)",
              fontSize: 12,
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={onUrlCommit}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Use
          </button>
        </div>
      ) : (
        /* Drag & drop zone */
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !hasImage && fileInputRef.current?.click()}
          style={{
            borderRadius: "var(--radius-lg)",
            border: `2px dashed ${isDragging ? "var(--accent)" : hasImage ? "var(--border)" : "var(--border)"}`,
            background: isDragging ? "var(--accent-light)" : hasImage ? "var(--surface-raised)" : "var(--surface-raised)",
            minHeight: hasImage ? "auto" : 140,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: hasImage ? "default" : "pointer",
            transition: "all 0.15s",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {hasImage ? (
            /* Thumbnail with swap button */
            <>
              <img
                src={imageUrl}
                alt="Uploaded"
                style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
              />
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  padding: "5px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "rgba(0,0,0,0.55)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  backdropFilter: "blur(4px)",
                }}
              >
                Change
              </button>
            </>
          ) : (
            /* Empty state */
            <>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-md)",
                background: "var(--accent-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v10M6 7l4-4 4 4" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 15h14" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 3 }}>
                Drop image here
              </p>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                or click to browse files
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};
