"use client";

import { Dialog } from "radix-ui";
import { FileText, LoaderCircle, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FC, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigationGuard } from "@/providers/NavigationGuardProvider";
import { searchHomebaseAction } from "../dal/mutations";
import type { GlobalSearchItem, GlobalSearchResponse } from "../types";

const subscribeToPlatform = () => () => {};
const getPlatformShortcut = () => typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "⌘ K" : "Ctrl K";
const getServerShortcut = () => "Ctrl K";

const GlobalSearch: FC = () => {
  const router = useRouter();
  const { canLeave } = useNavigationGuard();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<GlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const shortcut = useSyncExternalStore(subscribeToPlatform, getPlatformShortcut, getServerShortcut);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestId = useRef(0);

  const items = useMemo(() => [
    ...(response?.monthlyExpenses.items ?? []).map((item) => ({ ...item, group: "Közműkimutatások" })),
    ...(response?.notes.items ?? []).map((item) => ({ ...item, group: "Jegyzetek" })),
  ], [response]);

  const changeOpen = useCallback((nextOpen: boolean) => {
    requestId.current += 1;
    setOpen(nextOpen);
    setQuery("");
    setResponse(null);
    setActionError("");
    setLoading(false);
    setActiveIndex(-1);
  }, []);

  const changeQuery = (value: string) => {
    requestId.current += 1;
    setQuery(value);
    setResponse(null);
    setActionError("");
    setActiveIndex(-1);
    setLoading(value.trim().length >= 2);
  };

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        changeOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [changeOpen]);

  useEffect(() => {
    if (!open) return;
    const value = query.trim();
    if (value.length < 2) return;

    const request = requestId.current;
    const timeout = window.setTimeout(async () => {
      try {
        const result = await searchHomebaseAction(value);
        if (requestId.current !== request) return;
        if (result.success) setResponse(result.data);
        else setActionError(result.error.message);
      } catch {
        if (requestId.current === request) setActionError("A keresés most nem érhető el. Próbáld újra.");
      } finally {
        if (requestId.current === request) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [open, query]);

  const selectItem = (item: GlobalSearchItem) => {
    if (!canLeave()) return;
    changeOpen(false);
    router.push(item.href);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!items.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => index < items.length - 1 ? index + 1 : 0);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => index > 0 ? index - 1 : items.length - 1);
    }
    if (event.key === "Enter" && activeIndex >= 0 && items[activeIndex]) {
      event.preventDefault();
      selectItem(items[activeIndex]);
    }
  };

  const hasResult = Boolean(response && (response.notes.items.length || response.monthlyExpenses.items.length));

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Keresés" className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-2.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted sm:h-11 sm:min-w-0 sm:flex-1 sm:justify-start sm:px-3.5">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="hidden truncate sm:inline">Keresés a Homebase-ben…</span>
          <kbd className="ml-auto hidden shrink-0 whitespace-nowrap rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">{shortcut}</kbd>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-[#0b1628]/55 backdrop-blur-sm" />
        <Dialog.Content onKeyDown={handleKeyDown} onOpenAutoFocus={(event) => { event.preventDefault(); window.setTimeout(() => inputRef.current?.focus(), 0); }} aria-describedby="global-search-description" className="fixed left-1/2 top-[12dvh] z-[70] flex max-h-[78dvh] w-[min(94vw,660px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none sm:top-[16dvh]">
          <Dialog.Title className="sr-only">Keresés a Homebase-ben</Dialog.Title>
          <Dialog.Description id="global-search-description" className="sr-only">Jegyzetek és mentett közműkimutatások keresése.</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <Input ref={inputRef} autoComplete="off" spellCheck={false} value={query} maxLength={120} onChange={(event) => changeQuery(event.target.value)} aria-label="Keresőkifejezés" aria-controls="global-search-results" aria-activedescendant={activeIndex >= 0 ? `global-search-result-${activeIndex}` : undefined} placeholder="Keress jegyzetben, szolgáltatóban vagy számlaszámban…" className="h-14 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" />
            {query && <Button type="button" variant="ghost" size="icon" aria-label="Keresés törlése" onClick={() => { changeQuery(""); inputRef.current?.focus(); }}><X /></Button>}
            <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:inline">Esc</kbd>
          </div>

          <div id="global-search-results" role="listbox" aria-label="Keresési találatok" aria-busy={loading} className="min-h-32 overflow-y-auto p-3">
            {query.trim().length < 2 && <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><Search aria-hidden="true" className="size-6 opacity-60" /><p>Írj be legalább két karaktert.</p></div>}
            {loading && <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Keresés…</div>}
            {actionError && !loading && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{actionError}</div>}
            {!loading && response && <>
              {response.monthlyExpenses.error && <p role="status" className="mx-2 mb-2 text-xs text-muted-foreground">{response.monthlyExpenses.error}</p>}
              {response.monthlyExpenses.items.length > 0 && <section role="group" aria-label="Közműkimutatások" className="mb-3">
                <h2 className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Közműkimutatások</h2>
                <div className="grid gap-1">{response.monthlyExpenses.items.map((item, index) => <Link key={`expense-${item.id}`} id={`global-search-result-${index}`} role="option" aria-selected={activeIndex === index} href={item.href} onMouseMove={() => setActiveIndex(index)} onClick={(event) => { if (!event.defaultPrevented) changeOpen(false); }} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors ${activeIndex === index ? "bg-primary/10" : "hover:bg-muted"}`}>
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#fff0ee] text-[#b34330]"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
                </Link>)}</div>
              </section>}
              {response.notes.error && <p role="status" className="mx-2 mb-2 text-xs text-muted-foreground">{response.notes.error}</p>}
              {response.notes.items.length > 0 && <section role="group" aria-label="Jegyzetek">
                <h2 className="px-2 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jegyzetek</h2>
                <div className="grid gap-1">{response.notes.items.map((item, index) => {
                  const resultIndex = (response?.monthlyExpenses.items.length ?? 0) + index;
                  return <Link key={`note-${item.id}`} id={`global-search-result-${resultIndex}`} role="option" aria-selected={activeIndex === resultIndex} href={item.href} onMouseMove={() => setActiveIndex(resultIndex)} onClick={(event) => { if (!event.defaultPrevented) changeOpen(false); }} className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition-colors ${activeIndex === resultIndex ? "bg-primary/10" : "hover:bg-muted"}`}>
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e7f6f1] text-[#087b45]"><FileText className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
                  </Link>;
                })}</div>
              </section>}
              {!hasResult && !response.notes.error && !response.monthlyExpenses.error && <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">Nincs találat erre: „{query.trim()}”</div>}
              {!hasResult && (response.notes.error || response.monthlyExpenses.error) && !response.notes.items.length && !response.monthlyExpenses.items.length && <div role="status" className="mt-3 text-center text-sm text-muted-foreground">A keresési eredmények most nem érhetők el.</div>}
            </>}
          </div>
          <footer className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground"><span>A találat megnyitásához használd a nyilakat és az Entert.</span><span>{shortcut}</span></footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default GlobalSearch;
