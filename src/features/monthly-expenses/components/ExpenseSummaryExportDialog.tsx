"use client";

import { Dialog } from "radix-ui";
import { Download, LoaderCircle, Mail, X } from "lucide-react";
import { useRef, useState, type FC } from "react";
import { Button } from "@/components/ui/button";
import { connectGmailForSending } from "../dal/connection";
import { sendSummaryEmail } from "../dal/export";
import type { SummaryExportSnapshot, SummaryExportFormat } from "../types";
import { createSummaryEmailContent, createSummaryExportFile, SUMMARY_EMAIL_RECIPIENT } from "../utils/summary-export";

interface ExpenseSummaryExportDialogProps {
  snapshot: SummaryExportSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const maxEmailAttachmentBytes = 2 * 1024 * 1024;

const ExpenseSummaryExportDialog: FC<ExpenseSummaryExportDialogProps> = ({ snapshot, open, onOpenChange }) => {
  const [format, setFormat] = useState<SummaryExportFormat>("pdf");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresSendPermission, setRequiresSendPermission] = useState(false);
  const [sent, setSent] = useState(false);
  const preparedFileRef = useRef<File | null>(null);
  const busyRef = useRef(false);

  const prepareFile = async () => {
    if (preparedFileRef.current) return preparedFileRef.current;
    const file = await createSummaryExportFile(snapshot, format);
    preparedFileRef.current = file;
    return file;
  };

  const selectFormat = (nextFormat: SummaryExportFormat) => {
    setFormat(nextFormat);
    preparedFileRef.current = null;
    setError(null);
  };

  const download = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const file = await prepareFile();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "A kimutatás nem tölthető le.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const sendEmail = async () => {
    if (busyRef.current || sent) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setRequiresSendPermission(false);
    try {
      const file = await prepareFile();
      if (file.size > maxEmailAttachmentBytes) {
        setError("Ez a fájl túl nagy az e-mailhez. Töltsd le, és küldd el kézzel.");
        return;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const result = await sendSummaryEmail({
        reportMonth: snapshot.reportMonth,
        format,
        total: snapshot.total,
        half: snapshot.half,
        attachmentBase64: btoa(binary),
      });
      if (!result.success) {
        setError(result.error.message);
        setRequiresSendPermission(result.error.type === "gmail-send-permission-required");
        return;
      }
      setSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Az e-mailt most nem sikerült elküldeni.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const connectForSending = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await connectGmailForSending();
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "A Gmail-kapcsolat most nem indítható el.");
      busyRef.current = false;
      setBusy(false);
    }
  };

  const monthLabel = snapshot.monthLabel;
  const { subject: emailSubject, body: emailBody } = createSummaryEmailContent(monthLabel, snapshot.total, snapshot.half);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(calc(100vw-2rem),42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl sm:p-7">
          <header className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-serif text-2xl font-semibold">Kimutatás exportálása</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">{monthLabel} · a megnyitás pillanatában látható tételek</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Ablak bezárása" disabled={busy}><X aria-hidden="true" /></Button>
            </Dialog.Close>
          </header>

          <fieldset className="mt-6" disabled={busy}>
            <legend className="text-sm font-medium">Fájlformátum</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(["pdf", "png", "txt"] as const).map((option) => (
                <label key={option} className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-medium ${format === option ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background text-muted-foreground"}`}>
                  <input type="radio" name="summary-format" value={option} checked={format === option} onChange={() => selectFormat(option)} className="accent-primary" />
                  {{ pdf: "PDF", png: "Kép (PNG)", txt: "Szöveg (TXT)" }[option]}
                </label>
              ))}
            </div>
          </fieldset>

          <section className="mt-6 rounded-xl border border-border bg-background p-4" aria-label="E-mail előnézete">
            <p className="text-sm font-semibold">E-mail előnézete</p>
            <p className="mt-2 text-sm"><span className="font-medium">Címzett:</span> {SUMMARY_EMAIL_RECIPIENT}</p>
            <p className="mt-1 break-words text-sm"><span className="font-medium">Tárgy:</span> {emailSubject}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-muted-foreground">{emailBody}</pre>
            <p className="mt-2 break-words text-xs text-muted-foreground">Csatolmány: havi-kimutatas-{snapshot.reportMonth}.{format}</p>
          </section>

          <p className="mt-4 rounded-xl bg-note-peach/60 p-3 text-sm leading-6">A kimutatás a böngészőfülön él, és kapcsolatváltáskor elveszhet. Engedélykérés előtt töltsd le.</p>
          {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">{error}</p>}
          {sent && <p role="status" className="mt-3 rounded-xl bg-note-sage p-3 text-sm">Az e-mail elküldve a sz.marcsi85@gmail.com címre.</p>}

          <footer className="mt-6 flex flex-col gap-2 [&>button]:min-h-11 sm:flex-row sm:flex-wrap sm:justify-end">
            {requiresSendPermission && <Button type="button" variant="outline" onClick={() => void connectForSending()} disabled={busy}>Gmail-küldés engedélyezése</Button>}
            <Button type="button" variant="outline" onClick={() => void download()} disabled={busy}>
              {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Download data-icon="inline-start" />}
              Letöltés
            </Button>
            <Button type="button" onClick={() => void sendEmail()} disabled={busy || sent}>
              {busy ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : <Mail data-icon="inline-start" />}
              E-mail küldése
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ExpenseSummaryExportDialog;
