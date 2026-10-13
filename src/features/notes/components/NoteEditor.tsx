"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bold, Italic, List, ListOrdered, Save } from "lucide-react";
import { type FC, type ReactNode, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NoteContent from "./NoteContent";
import { noteFormSchema } from "../zod/schema";
import type { NoteFormInput, NoteCard as NoteCardData, NoteCreateInput } from "../types";

interface NoteEditorProps {
  initialNote: NoteCardData | null;
  userName?: string | null;
  onSave: (input: NoteCreateInput) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
  children?: ReactNode;
}

const NoteEditor: FC<NoteEditorProps> = ({ initialNote, userName, onSave, onDirtyChange, onCancel, onDelete, children }) => {
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [preview, setPreview] = useState(false);
  const form = useForm<NoteFormInput, unknown, NoteCreateInput>({
    mode: "all",
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: initialNote?.title ?? "",
      content: initialNote?.content ?? "",
      visibility: initialNote?.visibility ?? "private",
    },
  });
  const pending = form.formState.isSubmitting;
  const content = useWatch({ control: form.control, name: "content" }) ?? "";
  const title = useWatch({ control: form.control, name: "title" }) ?? "";
  const authorName = initialNote?.ownerName?.trim() || userName?.trim() || "Te";
  const authorInitial = authorName.charAt(0).toLocaleUpperCase("hu-HU") || "?";

  const changeDirty = () => onDirtyChange(true);
  const contentField = form.register("content", { onChange: changeDirty });
  const applyMarker = (marker: "**" | "*" | "- " | "1. ") => {
    const textarea = contentRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd, value } = textarea;
    const isList = marker.endsWith(" ");
    let start = selectionStart;
    let end = selectionEnd;
    if (isList) {
      const previousLineBreak = value.lastIndexOf("\n", Math.max(0, selectionStart - 1));
      start = previousLineBreak + 1;
      const nextLineBreak = value.indexOf("\n", selectionEnd);
      end = nextLineBreak === -1 ? value.length : nextLineBreak;
    }
    const selected = value.slice(start, end);
    const replacement = isList
      ? selected.split("\n").map((line, index) => `${marker === "1. " ? `${index + 1}. ` : marker}${line}`).join("\n")
      : selected ? `${marker}${selected}${marker}` : `${marker}${marker}`;
    const replaceStart = isList ? start : selectionStart;
    const replaceEnd = isList ? end : selectionEnd;
    const nextValue = `${value.slice(0, replaceStart)}${replacement}${value.slice(replaceEnd)}`;
    form.setValue("content", nextValue, { shouldDirty: true, shouldValidate: true });
    onDirtyChange(true);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = selected ? replaceStart + replacement.length : replaceStart + marker.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const submit = form.handleSubmit(async (values) => {
    const saved = await onSave(values);
    if (saved) toast.success("A jegyzet elmentve.");
    else toast.error("A jegyzet mentése nem sikerült.");
  });

  return (
    <form onSubmit={submit} className="flex h-full min-h-0 flex-col px-5 py-4 sm:px-7 sm:py-6">
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-5 overflow-y-auto pb-4 lg:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
        <label className="grid gap-2 text-sm font-medium" htmlFor="note-title">Cím <span className="font-normal text-muted-foreground">(nem kötelező)</span>
          <Input id="note-title" maxLength={120} aria-invalid={Boolean(form.formState.errors.title)} aria-describedby="note-title-error note-title-count" disabled={pending} placeholder="Adj egy címet a jegyzetnek…" {...form.register("title", { onChange: changeDirty })} />
          <span className="flex justify-between gap-3 text-xs text-muted-foreground"><span id="note-title-error" role="alert" className="text-destructive">{form.formState.errors.title?.message}</span><span id="note-title-count">{title.length}/120</span></span>
        </label>
        <fieldset disabled={pending} className="min-w-0">
          <label className="mb-2 block text-sm font-medium" htmlFor="note-content">Tartalom</label>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/50 p-2">
            <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Szövegformázás">
              <Button type="button" variant="ghost" size="icon" aria-label="Félkövér" title="Félkövér" disabled={pending || preview} onClick={() => applyMarker("**")}><Bold /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Dőlt" title="Dőlt" disabled={pending || preview} onClick={() => applyMarker("*")}><Italic /></Button>
              <span aria-hidden="true" className="my-1 w-px bg-border" />
              <Button type="button" variant="ghost" size="icon" aria-label="Felsorolás" title="Felsorolás" disabled={pending || preview} onClick={() => applyMarker("- ")}><List /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Számozott lista" title="Számozott lista" disabled={pending || preview} onClick={() => applyMarker("1. ")}><ListOrdered /></Button>
            </div>
            <div role="group" aria-label="Jegyzet nézete" className="flex gap-1">
              <Button type="button" size="sm" variant={preview ? "outline" : "warm"} aria-pressed={!preview} onClick={() => setPreview(false)}>Szerkesztés</Button>
              <Button type="button" size="sm" variant={preview ? "warm" : "outline"} aria-pressed={preview} onClick={() => setPreview(true)}>Előnézet</Button>
            </div>
          </div>
          {preview
            ? <div role="region" aria-label="Jegyzet előnézete" className="min-h-[40dvh] w-full rounded-xl border border-border bg-card p-4 text-base leading-7 lg:min-h-[390px]"><NoteContent content={content} /></div>
            : <textarea id="note-content" {...contentField} ref={(element) => { contentRef.current = element; contentField.ref(element); }} maxLength={5000} rows={8} placeholder="Írd ide a jegyzet tartalmát…" aria-describedby="note-content-error note-content-count" aria-invalid={Boolean(form.formState.errors.content)} className="min-h-[40dvh] w-full resize-y rounded-xl border border-input bg-background p-4 text-base leading-7 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[390px]" />}
          <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground"><span id="note-content-error" role="alert" className="text-destructive">{form.formState.errors.content?.message}</span><span id="note-content-count">{content.length}/5000</span></div>
        </fieldset>
        </div>
      <aside className="grid content-start gap-4 rounded-2xl border border-border bg-muted/35 p-4 sm:p-5">
        <fieldset disabled={pending} className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Láthatóság</legend>
          <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" value="private" {...form.register("visibility", { onChange: changeDirty })} /><span><span className="block text-sm font-semibold">Privát</span><span className="text-xs text-muted-foreground">Csak te láthatod ezt a jegyzetet.</span></span></label>
          <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="radio" value="family" {...form.register("visibility", { onChange: changeDirty })} /><span><span className="block text-sm font-semibold">Családdal megosztott</span><span className="text-xs text-muted-foreground">Minden családtag láthatja.</span></span></label>
        </fieldset>
        <div className="grid gap-2"><h3 className="text-sm font-semibold">Szerző</h3><div className="flex items-center gap-3 rounded-xl bg-card p-3"><span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{authorInitial}</span><span className="min-w-0 truncate text-sm">{authorName}</span></div></div>
        <p className="text-sm text-destructive" role="alert">{form.formState.errors.root?.message}</p>
      </aside>
      {children}
      </div>
      <div className="z-10 -mx-5 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:-mx-7 sm:px-7">
        {onDelete ? <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>Törlés</Button> : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Mégse</Button>
          <Button type="submit" variant="warm" disabled={pending || !form.formState.isValid}><Save />{pending ? "Mentés…" : "Jegyzet mentése"}</Button>
        </div>
      </div>
    </form>
  );
};

export default NoteEditor;
