"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { type FC, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NoteRichTextEditor from "./NoteRichTextEditor";
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
          <Input id="note-title" maxLength={120} aria-invalid={Boolean(form.formState.errors.title)} aria-describedby="note-title-error note-title-count" disabled={pending} placeholder="Adj egy címet a jegyzetnek…" className="focus-visible:ring-inset" {...form.register("title", { onChange: changeDirty })} />
          <span className="flex justify-between gap-3 text-xs text-muted-foreground"><span id="note-title-error" role="alert" className="text-destructive">{form.formState.errors.title?.message}</span><span id="note-title-count">{title.length}/120</span></span>
        </label>
        <fieldset disabled={pending} className="min-w-0">
          <label id="note-content-label" className="mb-2 block text-sm font-medium" htmlFor="note-content">Tartalom</label>
          <Controller
            name="content"
            control={form.control}
            render={({ field }) => (
              <NoteRichTextEditor
                value={field.value}
                onChange={field.onChange}
                onDirtyChange={changeDirty}
                onBlur={field.onBlur}
                invalid={Boolean(form.formState.errors.content)}
                disabled={pending}
              />
            )}
          />
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
