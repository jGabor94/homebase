"use client";

import { AlertDialog, Dialog } from "radix-ui";
import { AlertCircle, FilePlus2, LoaderCircle, LockKeyhole, Pencil, RefreshCw, Trash2, UsersRound, X } from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { createNote, deleteNote, loadNote, loadNotesPage, updateNote } from "../dal/mutations";
import type { NoteCard as NoteCardData, NoteCreateInput, NoteDeleteInput, NotePage, NoteUpdateInput } from "../types";
import NoteCard from "./NoteCard";
import NoteContent from "./NoteContent";
import NoteEditor from "./NoteEditor";

interface NoteBoardProps {
  initialPage: NotePage | null;
  userId: string;
  initialError?: string;
}

type DialogMode = "closed" | "loading" | "read" | "create" | "edit";
type NoteDraft = { title: string | null; content: string; visibility: "private" | "family" };

const emptyResultMessage = "A jegyzetfal most nem tölthető be. Próbáld újra.";

const NoteBoard: FC<NoteBoardProps> = ({ initialPage, userId, initialError }) => {
  const [notes, setNotes] = useState(initialPage?.notes ?? []);
  const [cursor, setCursor] = useState(initialPage?.nextCursor ?? null);
  const [loadError, setLoadError] = useState(initialError ?? "");
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<DialogMode>("closed");
  const [selected, setSelected] = useState<NoteCardData | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflictDraft, setConflictDraft] = useState<NoteDraft | null>(null);
  const openRequest = useRef(0);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  const close = () => {
    openRequest.current += 1;
    setMode("closed");
    setSelected(null);
    setDirty(false);
    setConfirm(null);
    setActionError("");
    setConflictDraft(null);
  };

  const openNote = async (id: string) => {
    const request = ++openRequest.current;
    setMode("loading");
    setActionError("");
    setSelected(null);
    try {
      const result = await loadNote(id);
      if (openRequest.current !== request) return;
      if (result.success) {
        setSelected(result.data);
        setMode("read");
      } else {
        setMode("closed");
        setLoadError(result.error.message);
      }
    } catch {
      if (openRequest.current !== request) return;
      setMode("closed");
      setLoadError("A jegyzet nem érhető el. Próbáld újra.");
    }
  };

  const save = async (input: NoteCreateInput): Promise<boolean> => {
    setPending(true);
    setActionError("");
    try {
      if (mode === "edit" && selected) {
        const updateInput: NoteUpdateInput = { ...input, id: selected.id, expectedVersion: selected.version };
        const result = await updateNote(updateInput);
        if (!result.success) {
          if (result.error.type === "note-version-conflict") setConflictDraft(input);
          setActionError(result.error.message);
          return false;
        }
        setSelected(result.data);
        setNotes((current) => [result.data, ...current.filter((note) => note.id !== result.data.id)]);
      } else {
        const result = await createNote(input);
        if (!result.success) {
          setActionError(result.error.message);
          return false;
        }
        setNotes((current) => [result.data, ...current.filter((note) => note.id !== result.data.id)]);
        setSelected(result.data);
      }
      setDirty(false);
      setConflictDraft(null);
      setMode("read");
      return true;
    } catch {
      setActionError("A jegyzet most nem menthető. Próbáld újra.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      const result = await loadNotesPage(cursor);
      if (result.success) {
        setNotes((current) => {
          const existingIds = new Set(current.map((note) => note.id));
          return [...current, ...result.data.notes.filter((note) => !existingIds.has(note.id))];
        });
        setCursor(result.data.nextCursor);
      } else setLoadError(result.error.message || emptyResultMessage);
    } catch { setLoadError(emptyResultMessage); }
    finally { setLoadingMore(false); }
  };

  const reloadList = async () => {
    setLoadError("");
    try {
      const result = await loadNotesPage(null);
      if (result.success) {
        setNotes(result.data.notes);
        setCursor(result.data.nextCursor);
      } else setLoadError(result.error.message || emptyResultMessage);
    } catch { setLoadError(emptyResultMessage); }
  };

  const confirmDelete = async () => {
    if (!selected) return;
    setPending(true);
    const input: NoteDeleteInput = { id: selected.id, expectedVersion: selected.version };
    try {
      const result = await deleteNote(input);
      if (!result.success) {
        if (result.error.type === "note-version-conflict") setConflictDraft({ title: selected.title, content: selected.content, visibility: selected.visibility });
        setActionError(result.error.message);
        setConfirm(null);
        return;
      }
      setNotes((current) => current.filter((note) => note.id !== selected.id));
      close();
    } catch { setActionError("A jegyzet most nem törölhető. Próbáld újra."); }
    finally { setPending(false); }
  };

  const reloadConflict = async () => {
    if (!selected) return;
    setPending(true);
    try {
      const result = await loadNote(selected.id);
      if (result.success) {
        setSelected(result.data);
        setEditorVersion((version) => version + 1);
        setActionError("");
      } else setActionError(result.error.message);
    } catch { setActionError("A frissebb jegyzet most nem tölthető be. Próbáld újra."); }
    finally { setPending(false); }
  };

  const restoreConflictDraft = () => {
    if (!selected || !conflictDraft) return;
    setSelected({ ...selected, ...conflictDraft });
    setEditorVersion((version) => version + 1);
    setDirty(true);
    setConflictDraft(null);
    setActionError("");
    setMode("edit");
  };

  const owner = Boolean(selected && selected.ownerId === userId);
  const editorNote = selected;

  return (
    <>
      <div className="mb-5 flex justify-end"><Button onClick={() => { setSelected(null); setMode("create"); setDirty(false); setActionError(""); }}><FilePlus2 />Új jegyzet</Button></div>
      {loadError && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><span className="inline-flex items-center gap-2"><AlertCircle aria-hidden="true" />{loadError}</span><Button variant="outline" onClick={reloadList}><RefreshCw />Újrapróbálás</Button></div>}
      {notes.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center">
          <p className="font-serif text-2xl text-foreground">Még üres a fal.</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Írj egy cetlit magadnak, vagy oszd meg a családdal, ami fontos.</p>
          <Button className="mt-5" onClick={() => { setSelected(null); setMode("create"); setDirty(false); }}><FilePlus2 />Új jegyzet</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {notes.map((note) => <NoteCard key={note.id} note={note} onOpen={() => void openNote(note.id)} />)}
        </div>
      )}
      {cursor && <div className="mt-7 flex justify-center"><Button variant="outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="animate-spin" /> : null}{loadingMore ? "Betöltés…" : "További jegyzetek"}</Button></div>}

      <Dialog.Root open={mode !== "closed"} onOpenChange={(open) => {
        if (open || pending) return;
        if (dirty) setConfirm("discard");
        else close();
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content aria-describedby="note-dialog-description" className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[min(94vw,680px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl outline-none sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-serif text-2xl font-semibold">{mode === "create" ? "Új jegyzet" : mode === "edit" ? "Jegyzet szerkesztése" : mode === "loading" ? "Jegyzet megnyitása" : selected?.title || "Cím nélküli jegyzet"}</Dialog.Title>
                <Dialog.Description id="note-dialog-description" className="mt-1 text-sm text-muted-foreground">{mode === "read" ? "A saját és közös cetlijeink." : "A változtatások mentés után kerülnek a falra."}</Dialog.Description>
              </div>
              <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Bezárás" disabled={pending}><X /></Button></Dialog.Close>
            </div>

            {mode === "loading" && <div className="flex min-h-40 items-center justify-center text-muted-foreground"><LoaderCircle className="animate-spin" aria-label="Betöltés" /></div>}
            {mode === "read" && selected && <>
              <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">{selected.visibility === "family" ? <UsersRound aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{selected.visibility === "family" ? "Családdal megosztott" : "Privát"}</span>
                <span>{selected.ownerName || "Családtag"}</span>
                <time dateTime={selected.updatedAt}>{new Intl.DateTimeFormat("hu-HU", { dateStyle: "long", timeZone: "Europe/Budapest" }).format(new Date(selected.updatedAt))}</time>
              </div>
              <div className="max-h-[52dvh] overflow-y-auto rounded-xl border border-border bg-card p-5 leading-7"><NoteContent content={selected.content} /></div>
              {owner && <div className="mt-5 flex justify-end"><Button onClick={() => { setMode("edit"); setDirty(false); setActionError(""); }}><Pencil />Szerkesztés</Button></div>}
            </>}

            {(mode === "create" || mode === "edit") && <NoteEditor key={`${mode}-${selected?.id ?? "new"}-${editorVersion}`} initialNote={editorNote} onSave={save} onDirtyChange={setDirty} onCancel={() => {
              if (dirty) setConfirm("discard");
              else close();
            }} onDelete={mode === "edit" ? () => setConfirm("delete") : undefined} />}

            {actionError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{actionError}</div>}
            {conflictDraft && <div className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3"><p className="text-sm font-medium">A saját mentetlen szöveged itt maradt:</p><textarea readOnly aria-label="Saját, mentésre váró változat" value={conflictDraft.content} rows={4} className="w-full rounded-md border border-input bg-background p-2 text-sm leading-5" /><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={reloadConflict}><RefreshCw />Friss változat betöltése</Button>{selected && <Button variant="outline" disabled={pending} onClick={restoreConflictDraft}>Saját szöveg visszaállítása</Button>}</div></div>}

          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AlertDialog.Root open={confirm !== null} onOpenChange={(open) => { if (!open && !pending) setConfirm(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/45" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 shadow-xl outline-none">
            <AlertDialog.Title className="font-serif text-xl">{confirm === "delete" ? "Törlöd ezt a jegyzetet?" : "Elveted a módosításokat?"}</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">{confirm === "delete" ? "A jegyzet véglegesen törlődik." : "A mentetlen változtatásaid elvesznek."}</AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild><Button variant="outline" disabled={pending}>Vissza</Button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><Button variant={confirm === "delete" ? "destructive" : "default"} disabled={pending} onClick={(event) => { event.preventDefault(); if (confirm === "delete") void confirmDelete(); else close(); }}>{pending ? "Folyamatban…" : confirm === "delete" ? <><Trash2 />Törlés</> : "Változtatások elvetése"}</Button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
};

export default NoteBoard;
