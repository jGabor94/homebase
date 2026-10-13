"use client";

import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Smile,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { type FC, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { NoteEmoticons } from "../lib/emoticon-extension";
import { convertNoteEmoticons } from "../utils/note-emoticons";

interface NoteRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onDirtyChange: () => void;
  onBlur: () => void;
  invalid: boolean;
  disabled?: boolean;
}

const extensions = [
  StarterKit.configure({
    link: { openOnClick: false, autolink: false, linkOnPaste: false },
    underline: false,
    heading: { levels: [2, 3] },
  }),
  Markdown,
  NoteEmoticons,
];

const emojis = [
  ["😀", "Mosolygó"], ["😄", "Vidám"], ["😂", "Nevető"], ["🤣", "Hahotázó"],
  ["😊", "Kedves mosoly"], ["😉", "Kacsintó"], ["😍", "Szerelmes"], ["🥰", "Szeretettel"],
  ["😘", "Puszi"], ["😎", "Menő"], ["🤔", "Gondolkodó"], ["😅", "Megkönnyebbült"],
  ["😴", "Álmos"], ["😢", "Szomorú"], ["😭", "Síró"], ["😡", "Dühös"],
  ["👍", "Tetszik"], ["👎", "Nem tetszik"], ["👏", "Taps"], ["🙏", "Köszönöm"],
  ["❤️", "Szív"], ["🎉", "Ünneplés"], ["✅", "Kész"], ["🏠", "Otthon"],
] as const;

const NoteRichTextEditor: FC<NoteRichTextEditorProps> = ({ value, onChange, onDirtyChange, onBlur, invalid, disabled = false }) => {
  const valueRef = useRef(value);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const editor = useEditor({
    extensions,
    content: convertNoteEmoticons(value),
    contentType: "markdown",
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: "min-h-[40dvh] w-full rounded-xl bg-background p-4 text-base leading-7 outline-none lg:min-h-[390px]",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Jegyzet tartalma",
        id: "note-content",
        "aria-labelledby": "note-content-label",
        "aria-describedby": "note-content-error note-content-count",
        "aria-invalid": String(invalid),
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange(updatedEditor.getMarkdown());
      onDirtyChange();
    },
  });

  useEffect(() => {
    if (!editor || valueRef.current === value) return;
    valueRef.current = value;
    const normalized = convertNoteEmoticons(value);
    const currentContent = editor.getMarkdown();
    if (currentContent !== value && currentContent !== normalized) {
      editor.commands.setContent(normalized, { contentType: "markdown", emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    editor?.view.dom.setAttribute("aria-invalid", String(invalid));
  }, [editor, invalid]);

  const active = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      strike: currentEditor?.isActive("strike") ?? false,
      heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      heading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
      code: currentEditor?.isActive("code") ?? false,
      codeBlock: currentEditor?.isActive("codeBlock") ?? false,
      canUndo: currentEditor?.can().undo() ?? false,
      canRedo: currentEditor?.can().redo() ?? false,
    }),
  });

  const run = (command: () => boolean) => {
    command();
    editor?.commands.focus();
  };

  const toggleButton = (
    label: string,
    Icon: typeof Bold,
    pressed: boolean,
    command: () => boolean,
  ) => (
    <Button
      type="button"
      variant={pressed ? "secondary" : "ghost"}
      size="icon"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled || !editor}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => run(command)}
    >
      <Icon aria-hidden="true" />
    </Button>
  );

  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-input bg-background after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:border-2 after:border-transparent after:content-[''] focus-within:border-ring focus-within:after:border-ring">
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/50 p-2" role="toolbar" aria-label="Szövegformázás">
        {toggleButton("Félkövér", Bold, active?.bold ?? false, () => editor?.chain().focus().toggleBold().run() ?? false)}
        {toggleButton("Dőlt", Italic, active?.italic ?? false, () => editor?.chain().focus().toggleItalic().run() ?? false)}
        {toggleButton("Áthúzott", Strikethrough, active?.strike ?? false, () => editor?.chain().focus().toggleStrike().run() ?? false)}
        <span aria-hidden="true" className="my-1 w-px bg-border" />
        {toggleButton("Címsor 2", Heading2, active?.heading2 ?? false, () => editor?.chain().focus().toggleHeading({ level: 2 }).run() ?? false)}
        {toggleButton("Címsor 3", Heading3, active?.heading3 ?? false, () => editor?.chain().focus().toggleHeading({ level: 3 }).run() ?? false)}
        {toggleButton("Felsorolás", List, active?.bulletList ?? false, () => editor?.chain().focus().toggleBulletList().run() ?? false)}
        {toggleButton("Számozott lista", ListOrdered, active?.orderedList ?? false, () => editor?.chain().focus().toggleOrderedList().run() ?? false)}
        <Button type="button" variant="ghost" size="icon" aria-label="Listaelem behúzása" title="Listaelem behúzása" disabled={disabled || !editor} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor?.chain().focus().sinkListItem("listItem").run() ?? false)}><IndentIncrease aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Listaelem kihúzása" title="Listaelem kihúzása" disabled={disabled || !editor} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor?.chain().focus().liftListItem("listItem").run() ?? false)}><IndentDecrease aria-hidden="true" /></Button>
        {toggleButton("Idézet", Quote, active?.blockquote ?? false, () => editor?.chain().focus().toggleBlockquote().run() ?? false)}
        {toggleButton("Sorkód", Code, active?.code ?? false, () => editor?.chain().focus().toggleCode().run() ?? false)}
        <Button type="button" variant={active?.codeBlock ? "secondary" : "ghost"} size="icon" aria-label="Kódblokk" aria-pressed={active?.codeBlock ?? false} title="Kódblokk" disabled={disabled || !editor} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor?.chain().focus().toggleCodeBlock().run() ?? false)}><Code aria-hidden="true" /></Button>
        <span aria-hidden="true" className="my-1 w-px bg-border" />
        <Button type="button" variant={emojiPickerOpen ? "secondary" : "ghost"} size="icon" aria-label="Smiley-k és emojik" aria-expanded={emojiPickerOpen} aria-controls="note-emoji-picker" title="Smiley-k és emojik" disabled={disabled || !editor} onMouseDown={(event) => event.preventDefault()} onClick={() => setEmojiPickerOpen((open) => !open)}><Smile aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Visszavonás" title="Visszavonás" disabled={disabled || !active?.canUndo} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor?.chain().focus().undo().run() ?? false)}><Undo2 aria-hidden="true" /></Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Újra" title="Újra" disabled={disabled || !active?.canRedo} onMouseDown={(event) => event.preventDefault()} onClick={() => run(() => editor?.chain().focus().redo().run() ?? false)}><Redo2 aria-hidden="true" /></Button>
      </div>
      {emojiPickerOpen && <div id="note-emoji-picker" className="border-b border-border bg-muted/30 p-3" onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setEmojiPickerOpen(false);
          editor?.commands.focus();
        }
      }}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Smiley-k és emojik</p>
        <div role="group" aria-label="Válassz egy emojit" className="grid w-fit max-w-full grid-cols-4 gap-1 sm:grid-cols-8">
          {emojis.map(([emoji, label]) => <Button key={emoji} type="button" variant="ghost" size="icon" className="size-11" aria-label={label} title={label} disabled={disabled || !editor} onMouseDown={(event) => event.preventDefault()} onClick={() => {
            editor?.chain().focus().insertContent({ type: "text", text: emoji }).run();
            setEmojiPickerOpen(false);
          }}><span aria-hidden="true" className="text-2xl">{emoji}</span></Button>)}
        </div>
      </div>}
      <EditorContent
        editor={editor}
        onBlur={onBlur}
        className="min-h-[40dvh] lg:min-h-[390px] [&_.tiptap]:min-h-[40dvh] [&_.tiptap_blockquote]:my-3 [&_.tiptap_blockquote]:border-l-2 [&_.tiptap_blockquote]:border-primary/40 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_code]:rounded [&_.tiptap_code]:bg-muted [&_.tiptap_code]:px-1 [&_.tiptap_h2]:mb-2 [&_.tiptap_h2]:mt-4 [&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h3]:mb-2 [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold [&_.tiptap_li]:ml-5 [&_.tiptap_ol]:my-2 [&_.tiptap_ol]:list-decimal [&_.tiptap_p]:my-1 [&_.tiptap_pre]:my-3 [&_.tiptap_pre]:overflow-x-auto [&_.tiptap_pre]:rounded-lg [&_.tiptap_pre]:bg-muted [&_.tiptap_pre]:p-3 [&_.tiptap_strong]:font-semibold [&_.tiptap_ul]:my-2 [&_.tiptap_ul]:list-disc"
      />
    </div>
  );
};

export default NoteRichTextEditor;
