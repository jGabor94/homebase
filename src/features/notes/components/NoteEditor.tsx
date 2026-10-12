"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bold, Italic, List, ListOrdered, Save } from "lucide-react";
import { type FC, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { noteFormSchema } from "../zod/schema";
import type { NoteFormInput, NoteCard as NoteCardData, NoteCreateInput } from "../types";

interface NoteEditorProps {
  initialNote: NoteCardData | null;
  onSave: (input: NoteCreateInput) => Promise<boolean>;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const NoteEditor: FC<NoteEditorProps> = ({ initialNote, onSave, onDirtyChange, onCancel, onDelete }) => {
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
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
    <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
      <label className="grid gap-2 text-sm font-medium" htmlFor="note-title">Cím <span className="font-normal text-muted-foreground">(nem kötelező)</span>
        <Input id="note-title" maxLength={120} aria-invalid={Boolean(form.formState.errors.title)} aria-describedby="note-title-error" disabled={pending} {...form.register("title", { onChange: changeDirty })} />
        <span id="note-title-error" role="alert" className="text-xs text-destructive">{form.formState.errors.title?.message}</span>
      </label>
      <fieldset disabled={pending}>
        <label className="mb-2 block text-sm font-medium" htmlFor="note-content">Szöveg</label>
        <div className="mb-2 flex flex-wrap gap-2" role="toolbar" aria-label="Szövegformázás">
          <Button type="button" variant="outline" size="icon" aria-label="Félkövér" title="Félkövér" onClick={() => applyMarker("**")}><Bold /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Dőlt" title="Dőlt" onClick={() => applyMarker("*")}><Italic /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Felsorolás" title="Felsorolás" onClick={() => applyMarker("- ")}><List /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Számozott lista" title="Számozott lista" onClick={() => applyMarker("1. ")}><ListOrdered /></Button>
        </div>
        <textarea id="note-content" {...contentField} ref={(element) => { contentRef.current = element; contentField.ref(element); }} maxLength={5000} rows={11} aria-describedby="note-content-error note-content-count" aria-invalid={Boolean(form.formState.errors.content)} className="min-h-56 w-full resize-y rounded-md border border-input bg-background p-3 text-base leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground"><span id="note-content-error" role="alert">{form.formState.errors.content?.message}</span><span id="note-content-count">{content.length}/5000</span></div>
      </fieldset>
      <fieldset disabled={pending} className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Láthatóság</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3"><input type="radio" value="private" {...form.register("visibility", { onChange: changeDirty })} />Privát</label>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3"><input type="radio" value="family" {...form.register("visibility", { onChange: changeDirty })} />Családdal megosztott</label>
      </fieldset>
      <p className="text-sm text-destructive" role="alert">{form.formState.errors.root?.message}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        {onDelete ? <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>Törlés</Button> : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Mégse</Button>
          <Button type="submit" disabled={pending || !form.formState.isValid}><Save />{pending ? "Mentés…" : "Mentés"}</Button>
        </div>
      </div>
    </form>
  );
};

export default NoteEditor;
