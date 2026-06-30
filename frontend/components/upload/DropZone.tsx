"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { uploadFile, importUrl } from "@/lib/api";
import { getGeminiKey } from "@/lib/auth-token";

type FileStatus = "uploading" | "done" | "error";
type Tab = "file" | "url";

interface DropZoneProps {
  onUploadComplete?: (docId: string) => void;
  show: boolean;
  onClose: () => void;
}

function FileStatusIcon({ status }: { status: FileStatus }) {
  if (status === "uploading") {
    return (
      <svg className="animate-spin text-accent flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-green-400 flex-shrink-0">
        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-red-400 flex-shrink-0">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function DropZone({ onUploadComplete, show, onClose }: DropZoneProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [fileStatuses, setFileStatuses] = useState<Record<string, FileStatus>>({});
  const [urlInput, setUrlInput] = useState("");
  const [urlStatus, setUrlStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [urlError, setUrlError] = useState("");

  const isUploading = Object.values(fileStatuses).some((s) => s === "uploading");
  const isShowingProgress = Object.keys(fileStatuses).length > 0;

  const resetAndClose = () => {
    setFileStatuses({});
    setUrlInput("");
    setUrlStatus("idle");
    setUrlError("");
    onClose();
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      // Block uploads until a key is stored — embedding needs it. (Local dev
      // uses the server key, so skip the gate on localhost.)
      if (!/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && !getGeminiKey()) {
        resetAndClose();
        window.dispatchEvent(new CustomEvent("open-gemini-key"));
        return;
      }

      // Show all files as "uploading" immediately
      setFileStatuses(
        Object.fromEntries(acceptedFiles.map((f) => [f.name, "uploading" as FileStatus]))
      );

      // Upload all files in parallel
      await Promise.all(
        acceptedFiles.map(async (file) => {
          try {
            const result = await uploadFile(file);
            setFileStatuses((prev) => ({ ...prev, [file.name]: "done" }));
            onUploadComplete?.(result.document_id);
          } catch {
            setFileStatuses((prev) => ({ ...prev, [file.name]: "error" }));
          }
        })
      );

      setTimeout(resetAndClose, 2000);
    },
    [onUploadComplete, onClose]
  );

  const handleUrlImport = async () => {
    const url = urlInput.trim();
    if (!url) return;
    // Block imports until a key is stored — embedding needs it. (Local dev
    // uses the server key, so skip the gate on localhost.)
    if (!/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) && !getGeminiKey()) {
      resetAndClose();
      window.dispatchEvent(new CustomEvent("open-gemini-key"));
      return;
    }
    setUrlStatus("loading");
    setUrlError("");
    try {
      const result = await importUrl(url);
      setUrlStatus("done");
      onUploadComplete?.(result.document_id);
      setTimeout(resetAndClose, 1500);
    } catch (err) {
      setUrlStatus("error");
      setUrlError(err instanceof Error ? err.message : "Failed to import URL");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/markdown": [".md"],
      "text/plain": [".txt"],
      "text/html": [".html", ".htm"],
      "text/csv": [".csv"],
      "application/zip": [".zip"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/epub+zip": [".epub"],
    },
    maxSize: 50 * 1024 * 1024,
    disabled: isUploading,
  });

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploading) resetAndClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg mx-4 bg-surface-dark border border-border-dark rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tab bar */}
            <div className="flex border-b border-border-dark">
              {(["file", "url"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    tab === t
                      ? "text-accent border-b-2 border-accent"
                      : "text-secondary hover:text-primary-dark"
                  }`}
                >
                  {t === "file" ? "Upload File" : "Import URL"}
                </button>
              ))}
            </div>

            {tab === "file" ? (
              <div className="p-6">
                {isShowingProgress ? (
                  <div className="space-y-2 py-2">
                    {Object.entries(fileStatuses).map(([name, status]) => (
                      <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-bg-dark">
                        <FileStatusIcon status={status} />
                        <span className="text-sm text-primary-dark truncate flex-1 min-w-0">{name}</span>
                        <span className={`text-xs flex-shrink-0 ${
                          status === "done" ? "text-green-400" : status === "error" ? "text-red-400" : "text-secondary"
                        }`}>
                          {status === "uploading" ? "Uploading…" : status === "done" ? "Done" : "Failed"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={`p-10 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                      isDragActive
                        ? "border-accent bg-accent/5"
                        : "border-border-dark hover:border-accent/50"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
                          <path
                            d="M12 16V8m0 0l-3 3m3-3l3 3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                      <h3 className="text-base font-medium text-primary-dark mb-1.5">
                        {isDragActive ? "Drop files here" : "Import your notes"}
                      </h3>
                      <p className="text-sm text-secondary mb-4">
                        Drag & drop or click to browse · Multiple files supported
                      </p>
                      <div className="flex items-center justify-center gap-1.5 flex-wrap text-xs text-secondary">
                        {[".pdf", ".docx", ".pptx", ".xlsx", ".csv", ".epub", ".html", ".md", ".txt", ".zip"].map((ext) => (
                          <span key={ext} className="px-2 py-0.5 rounded-md bg-bg-dark">{ext}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* URL tab */
              <div className="p-6">
                <label className="block text-xs text-secondary uppercase tracking-wider mb-2">
                  Web page URL
                </label>
                <input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUrlImport(); }}
                  placeholder="https://example.com/article"
                  disabled={urlStatus === "loading"}
                  className="w-full bg-bg-dark border border-border-dark rounded-lg px-3 py-2.5 text-sm text-primary-dark placeholder-secondary outline-none focus:border-accent/50 transition-colors disabled:opacity-50 mb-3"
                />
                {urlError && (
                  <p className="text-xs text-red-400 mb-3">{urlError}</p>
                )}
                {urlStatus === "done" && (
                  <p className="text-xs text-green-400 mb-3">Page imported successfully!</p>
                )}
                <button
                  onClick={handleUrlImport}
                  disabled={!urlInput.trim() || urlStatus === "loading" || urlStatus === "done"}
                  className="w-full py-2.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-40 hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
                >
                  {urlStatus === "loading" ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Fetching page…
                    </>
                  ) : (
                    "Import page"
                  )}
                </button>
                <p className="text-xs text-secondary mt-3 text-center">
                  Fetches the page, extracts text, and adds it to your knowledge base
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
