"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { ExternalLink, X } from "lucide-react";
import type { InvoiceSource } from "../types";

interface SourcePreviewDialogProps {
  source: InvoiceSource;
  uploadPreviewUrls: Record<string, string>;
  onClose: () => void;
}

const SourcePreviewDialog: FC<SourcePreviewDialogProps> = ({ source, uploadPreviewUrls, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [previewUrl, setPreviewUrl] = useState(source.kind === "upload" ? uploadPreviewUrls[source.documentId] ?? null : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(source.kind === "gmail");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    if (source.kind !== "gmail") return;
    const params = new URLSearchParams({ reportMonth: source.reportMonth, messageId: source.messageId });
    if (source.attachmentId) params.set("attachmentId", source.attachmentId);
    if (source.linkIndex !== undefined) params.set("linkIndex", String(source.linkIndex));
    let active = true;
    let objectUrl: string | null = null;

    const loadPreview = async () => {
      try {
        const response = await fetch(`/api/monthly-expenses/source?${params.toString()}`);
        if (!response.ok) {
          const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          throw new Error(result?.error?.message ?? "A számla előnézete most nem érhető el.");
        }
        if (response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/pdf") {
          throw new Error("A számlaforrás nem PDF-et adott vissza; az előnézet nem nyitható meg.");
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreviewUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch (previewError) {
        if (active) setError(previewError instanceof Error ? previewError.message : "A számla előnézete nem nyitható meg.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadPreview();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} aria-labelledby="source-preview-title" onCancel={onClose} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-0 h-[94dvh] w-screen max-h-none max-w-none flex-col overflow-hidden border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/45 open:flex sm:m-auto sm:h-[85vh] sm:w-[min(calc(100vw-3rem),64rem)] sm:max-h-[90vh] sm:rounded-[22px]">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id="source-preview-title" className="truncate text-xl font-semibold tracking-tight text-foreground">Számla forrása</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{source.fileName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-background"><ExternalLink aria-hidden="true" className="size-4" /> Új lapon</a>}
            <button type="button" onClick={onClose} aria-label="Előnézet bezárása" className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-5" /></button>
          </div>
        </header>
        <div className="min-h-[50vh] flex-1 bg-background p-3 sm:min-h-[65vh]">
          {loading && <p role="status" className="p-6 text-center text-sm text-muted-foreground">A számla előnézetének betöltése…</p>}
          {error && <p role="alert" className="m-4 rounded-xl bg-note-peach p-4 text-sm text-foreground">{error}</p>}
          {/* Chromium's native PDF viewer cannot run inside a sandboxed iframe. Only validated PDF blobs are displayed here. */}
          {!loading && !error && previewUrl && <iframe title={`Számla előnézete: ${source.fileName}`} src={previewUrl} className="h-[65vh] w-full rounded-lg border border-border bg-white" />}
          {!loading && !error && !previewUrl && <p role="alert" className="p-6 text-center text-sm text-muted-foreground">Ehhez a forráshoz ebben a munkamenetben nem maradt előnézet.</p>}
        </div>
    </dialog>
  );
};

export default SourcePreviewDialog;
