"use client";

import { AlertDialog, Dialog } from "radix-ui";
import { AlertCircle, ArrowDownWideNarrow, ArrowUpNarrowWide, Grid2X2, List, LoaderCircle, LockKeyhole, Pencil, RefreshCw, Search, Trash2, UsersRound, X } from "lucide-react";
import { type FC, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useNavigationGuard } from "@/providers/NavigationGuardProvider";
import { Button } from "@/components/ui/button";
import AppCreationBar from "@/components/AppCreationBar";
import { Input } from "@/components/ui/input";
import { createNote, deleteNote, loadNote, loadNotesPage, updateNote } from "../dal/mutations";
import type { NoteCard as NoteCardData, NoteCreateInput, NoteDeleteInput, NotePage, NoteQuery, NoteQueryInput, NoteUpdateInput } from "../types";
import NoteCard from "./NoteCard";
import NoteContent from "./NoteContent";
import NoteEditor from "./NoteEditor";

interface NoteBoardProps {
  initialPage: NotePage | null;
  userId: string;
  userName?: string | null;
  initialError?: string;
  initialQuery?: Partial<NoteQueryInput>;
  initialNoteId?: string;
  startNew?: boolean;
}

type DialogMode = "closed" | "loading" | "read" | "create" | "edit";
type NoteDraft = { title: string | null; content: string; visibility: "private" | "family" };
type NoteFilter = NoteQuery["filter"];
type NoteSort = NoteQuery["sort"];

const emptyResultMessage = "A jegyzetfal most nem tölthető be. Próbáld újra.";
const defaultQuery: NoteQuery = { query: "", filter: "all", sort: "latest" };

const NoteBoard: FC<NoteBoardProps> = ({ initialPage, userId, userName, initialError, initialQuery, initialNoteId, startNew = false }) => {
  const router = useRouter();
  const { registerGuard } = useNavigationGuard();
  const [query, setQuery] = useState<NoteQuery>({ ...defaultQuery, ...initialQuery });
  const [notes, setNotes] = useState(initialPage?.notes ?? []);
  const [counts, setCounts] = useState(initialPage?.counts ?? { all: 0, private: 0, family: 0 });
  const [cursor, setCursor] = useState(initialPage?.nextCursor ?? null);
  const [loadError, setLoadError] = useState(initialError ?? "");
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [mode, setMode] = useState<DialogMode>(() => startNew ? "create" : "closed");
  const [selected, setSelected] = useState<NoteCardData | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState(false);
  const [conflictDraft, setConflictDraft] = useState<NoteDraft | null>(null);
  const openRequest = useRef(0);
  const listRequest = useRef(0);
  const lastInitialIntent = useRef<string | null>(startNew && !initialNoteId ? "new" : null);
  const skipFirstQueryEffect = useRef(true);

  const updateUrlIntent = useCallback((noteId?: string) => {
    const next = new URLSearchParams(window.location.search);
    next.delete("new");
    next.delete("note");
    if (noteId) next.set("note", noteId);
    const search = next.toString();
    router.replace(search ? `/app/notes?${search}` : "/app/notes", { scroll: false });
  }, [router]);

  const updateQuery = (change: (current: NoteQuery) => NoteQuery) => {
    // Invalidate an in-flight page request synchronously with the control change,
    // before React runs the query effect cleanup.
    listRequest.current += 1;
    setCursor(null);
    setLoadingMore(false);
    setRefreshing(true);
    setQuery(change);
  };

  useEffect(() => {
    if (!dirty && !pending) return;
    return registerGuard(() => {
      if (pending) return false;
      const shouldLeave = window.confirm("Elveted a mentetlen változtatásokat?");
      if (shouldLeave) setDirty(false);
      return shouldLeave;
    });
  }, [dirty, pending, registerGuard]);

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
    lastInitialIntent.current = null;
    updateUrlIntent();
  };

  const openNote = useCallback(async (id: string, intent: "read" | "edit" | "delete" = "read") => {
    const request = ++openRequest.current;
    setMode("loading");
    setActionError("");
    setSelected(null);
    lastInitialIntent.current = `note:${id}`;
    updateUrlIntent(id);
    try {
      const result = await loadNote(id);
      if (openRequest.current !== request) return;
      if (result.success) {
        setSelected(result.data);
        setMode(intent === "edit" && result.data.ownerId === userId ? "edit" : "read");
        if (intent === "delete" && result.data.ownerId === userId) setConfirm("delete");
      } else {
        setMode("closed");
        setLoadError(result.error.message);
        updateUrlIntent();
      }
    } catch {
      if (openRequest.current !== request) return;
      setMode("closed");
      setLoadError("A jegyzet nem érhető el. Próbáld újra.");
      updateUrlIntent();
    }
  }, [updateUrlIntent, userId]);

  const handleRouteIntent = useEffectEvent((noteId: string | undefined, shouldStartNew: boolean) => {
    if (noteId) {
      void openNote(noteId);
      return;
    }
    if (shouldStartNew) {
      setSelected(null);
      setMode("create");
      setDirty(false);
    }
  });

  const refreshList = useCallback(async (nextQuery: NoteQuery = query) => {
    const request = ++listRequest.current;
    setLoadingMore(false);
    setRefreshing(true);
    setLoadError("");
    try {
      const result = await loadNotesPage(null, nextQuery);
      if (listRequest.current !== request) return;
      if (result.success) {
        setNotes(result.data.notes);
        setCounts(result.data.counts);
        setCursor(result.data.nextCursor);
      } else setLoadError(result.error.message || emptyResultMessage);
    } catch { if (listRequest.current === request) setLoadError(emptyResultMessage); }
    finally { if (listRequest.current === request) setRefreshing(false); }
  }, [query]);

  useEffect(() => {
    if (skipFirstQueryEffect.current) {
      skipFirstQueryEffect.current = false;
      return;
    }
    const timer = window.setTimeout(() => { void refreshList(query); }, query.query ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      listRequest.current += 1;
    };
  }, [query, refreshList]);

  useEffect(() => {
    const intent = initialNoteId ? `note:${initialNoteId}` : startNew ? "new" : null;
    if (lastInitialIntent.current === intent) return;
    lastInitialIntent.current = intent;
    handleRouteIntent(initialNoteId, startNew);
  }, [initialNoteId, startNew]);

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
      } else {
        const result = await createNote(input);
        if (!result.success) {
          setActionError(result.error.message);
          return false;
        }
        setSelected(result.data);
      }
      setDirty(false);
      setConflictDraft(null);
      setMode("read");
      await refreshList(query);
      return true;
    } catch {
      setActionError("A jegyzet most nem menthető. Próbáld újra.");
      return false;
    } finally {
      setPending(false);
    }
  };

  const loadMore = async () => {
    if (!cursor || loadingMore || refreshing) return;
    const request = ++listRequest.current;
    setLoadingMore(true);
    setLoadError("");
    try {
      const result = await loadNotesPage(cursor, query);
      if (listRequest.current !== request) return;
      if (result.success) {
        setNotes((current) => {
          const existingIds = new Set(current.map((note) => note.id));
          return [...current, ...result.data.notes.filter((note) => !existingIds.has(note.id))];
        });
        setCursor(result.data.nextCursor);
        setCounts(result.data.counts);
      } else setLoadError(result.error.message || emptyResultMessage);
    } catch { if (listRequest.current === request) setLoadError(emptyResultMessage); }
    finally { if (listRequest.current === request) setLoadingMore(false); }
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
      setConfirm(null);
      close();
      await refreshList(query);
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
  const startCreate = () => {
    lastInitialIntent.current = null;
    setSelected(null);
    setMode("create");
    setDirty(false);
    setActionError("");
    updateUrlIntent();
  };

  const filters: { id: NoteFilter; label: string; icon: typeof Grid2X2 }[] = [
    { id: "all", label: "Összes", icon: Grid2X2 },
    { id: "private", label: "Privát", icon: LockKeyhole },
    { id: "family", label: "Megosztott", icon: UsersRound },
  ];
  const selectedCount = query.filter === "private" ? counts.private : query.filter === "family" ? counts.family : counts.all;

  return (
    <>
      <div className="mb-5">
        <AppCreationBar title="Jegyzetfal" description="Egy ötlet, teendő vagy fontos emlékeztető? Írd fel, hogy kéznél legyen." actionLabel="Új jegyzet" onAction={startCreate} />
      </div>
      <section aria-label="Jegyzetek keresése és szűrése" className="mb-6 grid gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
        <label className="relative block">
          <Search aria-hidden="true" className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query.query} maxLength={120} onChange={(event) => updateQuery((current) => ({ ...current, query: event.target.value }))} placeholder="Keresés a jegyzetekben…" aria-label="Keresés a jegyzetekben" className="h-12 rounded-xl pl-11" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Láthatósági szűrő" className="flex flex-wrap gap-2">
            {filters.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={query.filter === id} onClick={() => updateQuery((current) => ({ ...current, filter: id }))} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${query.filter === id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-muted"}`}><Icon aria-hidden="true" className="size-4" />{label}<span className={`rounded-full px-1.5 py-0.5 text-xs ${query.filter === id ? "bg-white/15" : "bg-muted text-muted-foreground"}`}>{id === "all" ? counts.all : counts[id]}</span></button>)}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="note-sort">Rendezés</label>
            <select id="note-sort" value={query.sort} onChange={(event) => updateQuery((current) => ({ ...current, sort: event.target.value as NoteSort }))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="latest">Legutóbbi</option><option value="oldest">Legrégebbi</option><option value="title">Cím szerint</option>
            </select>
            <div role="group" aria-label="Megjelenítés" className="flex rounded-xl border border-border bg-background p-1">
              <button type="button" aria-label="Rácsnézet" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")} className={`grid size-8 place-items-center rounded-lg ${layout === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Grid2X2 aria-hidden="true" className="size-4" /></button>
              <button type="button" aria-label="Listanézet" aria-pressed={layout === "list"} onClick={() => setLayout("list")} className={`grid size-8 place-items-center rounded-lg ${layout === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><List aria-hidden="true" className="size-4" /></button>
            </div>
          </div>
        </div>
        <div className="sr-only" aria-live="polite">{refreshing ? "Jegyzetek frissítése" : `${selectedCount} jegyzet`}</div>
      </section>

      {loadError && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><span className="inline-flex items-center gap-2"><AlertCircle aria-hidden="true" />{loadError}</span><Button variant="outline" onClick={() => void refreshList(query)}><RefreshCw />Újrapróbálás</Button></div>}
      {notes.length === 0 && !loadError ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/70 px-6 py-14 text-center">
          <p className="text-2xl font-semibold text-foreground">{query.query || query.filter !== "all" ? "Nincs ilyen jegyzet." : "Még üres a fal."}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{query.query || query.filter !== "all" ? "Próbálj más keresést vagy válassz másik szűrőt." : "Írj egy cetlit magadnak, vagy oszd meg a családdal, ami fontos."}</p>
        </div>
      ) : (
        <div aria-busy={refreshing} className={`${layout === "grid" ? "grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" : "grid grid-cols-1 gap-3"} ${refreshing ? "opacity-60" : ""}`}>
          {notes.map((note) => <NoteCard key={note.id} note={note} canEdit={note.ownerId === userId} list={layout === "list"} onOpen={() => void openNote(note.id)} onEdit={() => void openNote(note.id, "edit")} onDelete={() => void openNote(note.id, "delete")} />)}
        </div>
      )}
      {cursor && <div className="mt-7 flex justify-center"><Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore || refreshing}>{loadingMore ? <LoaderCircle className="animate-spin" /> : query.sort === "oldest" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}{loadingMore ? "Betöltés…" : "További jegyzetek"}</Button></div>}

      <Dialog.Root open={mode !== "closed"} onOpenChange={(open) => {
        if (open || pending) return;
        if (dirty) setConfirm("discard");
        else close();
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0b1628]/55 backdrop-blur-sm" />
          <Dialog.Content aria-describedby="note-dialog-description" className="fixed inset-0 z-50 m-0 flex h-dvh w-full translate-x-0 translate-y-0 flex-col overflow-hidden border-0 bg-background p-0 shadow-xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:m-0 sm:h-[min(850px,92dvh)] sm:w-[min(94vw,1040px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px] sm:border sm:border-border">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e7f6f1] text-[#087b45]"><Pencil className="size-5" /></span>
                <div className="min-w-0">
                  <Dialog.Title className="text-xl font-semibold tracking-tight sm:text-2xl">{mode === "create" ? "Új jegyzet létrehozása" : mode === "edit" ? "Jegyzet szerkesztése" : mode === "loading" ? "Jegyzet megnyitása" : selected?.title || "Cím nélküli jegyzet"}</Dialog.Title>
                  <Dialog.Description id="note-dialog-description" className="mt-1 text-sm leading-5 text-muted-foreground">{mode === "read" ? "A saját és közös cetlijeink." : "Jegyezd fel a gondolataidat, teendőidet vagy fontos információkat."}</Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild><Button variant="outline" size="icon" aria-label="Bezárás" disabled={pending}><X /></Button></Dialog.Close>
            </header>

            <div className={`${mode === "create" || mode === "edit" ? "flex min-h-0 flex-1 flex-col" : "min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7 sm:py-6"}`}>
              {mode === "loading" && <div className="flex min-h-40 items-center justify-center text-muted-foreground"><LoaderCircle className="animate-spin" aria-label="Betöltés" /></div>}
              {mode === "read" && selected && <>
                <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">{selected.visibility === "family" ? <UsersRound aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}{selected.visibility === "family" ? "Családdal megosztott" : "Privát"}</span>
                  <span>{selected.ownerName || "Családtag"}</span>
                  <time dateTime={selected.updatedAt}>{new Intl.DateTimeFormat("hu-HU", { dateStyle: "long", timeZone: "Europe/Budapest" }).format(new Date(selected.updatedAt))}</time>
                </div>
                <div className="min-h-64 rounded-2xl border border-border bg-card p-5 leading-7 sm:p-7"><NoteContent content={selected.content} /></div>
                {owner && <div className="mt-5 flex justify-end"><Button onClick={() => { setMode("edit"); setDirty(false); setActionError(""); }}><Pencil />Szerkesztés</Button></div>}
              </>}

              {(mode === "create" || mode === "edit") && <NoteEditor key={`${mode}-${selected?.id ?? "new"}-${editorVersion}`} initialNote={selected} userName={userName} onSave={save} onDirtyChange={setDirty} onCancel={() => {
                if (dirty) setConfirm("discard");
                else close();
              }} onDelete={mode === "edit" ? () => setConfirm("delete") : undefined}>
                {(actionError || conflictDraft) && <div className="grid gap-3 lg:col-span-2">
                  {actionError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{actionError}</div>}
                  {conflictDraft && <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3"><p className="text-sm font-medium">A saját mentetlen szöveged itt maradt:</p><textarea readOnly aria-label="Saját, mentésre váró változat" value={conflictDraft.content} rows={4} className="w-full rounded-md border border-input bg-background p-2 text-sm leading-5" /><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={pending} onClick={reloadConflict}><RefreshCw />Friss változat betöltése</Button>{selected && <Button type="button" variant="outline" disabled={pending} onClick={restoreConflictDraft}>Saját szöveg visszaállítása</Button>}</div></div>}
                </div>}
              </NoteEditor>}

              {mode !== "create" && mode !== "edit" && actionError && <div role="alert" className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{actionError}</div>}
              {mode !== "create" && mode !== "edit" && conflictDraft && <div className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3"><p className="text-sm font-medium">A saját mentetlen szöveged itt maradt:</p><textarea readOnly aria-label="Saját, mentésre váró változat" value={conflictDraft.content} rows={4} className="w-full rounded-md border border-input bg-background p-2 text-sm leading-5" /><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={reloadConflict}><RefreshCw />Friss változat betöltése</Button>{selected && <Button variant="outline" disabled={pending} onClick={restoreConflictDraft}>Saját szöveg visszaállítása</Button>}</div></div>}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <AlertDialog.Root open={confirm !== null} onOpenChange={(open) => { if (!open && !pending) setConfirm(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-black/45" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[min(92vw,400px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 shadow-xl outline-none">
            <AlertDialog.Title className="text-xl font-semibold">{confirm === "delete" ? "Törlöd ezt a jegyzetet?" : "Elveted a módosításokat?"}</AlertDialog.Title>
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
