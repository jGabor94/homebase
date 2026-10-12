export type NoteInline = { type: "text"; value: string } | { type: "bold" | "italic"; value: string };
export type NoteBlock =
  | { type: "paragraph"; lines: NoteInline[][] }
  | { type: "unordered-list"; items: NoteInline[][] }
  | { type: "ordered-list"; items: NoteInline[][] };

const inlinePattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

export const parseNoteInline = (line: string): NoteInline[] => {
  const result: NoteInline[] = [];
  let offset = 0;
  for (const match of line.matchAll(inlinePattern)) {
    const start = match.index ?? 0;
    if (start > offset) result.push({ type: "text", value: line.slice(offset, start) });
    const token = match[0];
    const strong = token.startsWith("**") || token.startsWith("__");
    result.push({ type: strong ? "bold" : "italic", value: token.slice(strong ? 2 : 1, strong ? -2 : -1) });
    offset = start + token.length;
  }
  if (offset < line.length) result.push({ type: "text", value: line.slice(offset) });
  return result.length > 0 ? result : [{ type: "text", value: line }];
};

const unorderedItem = /^\s{0,3}[-*+]\s+(.+)$/;
const orderedItem = /^\s{0,3}\d+\.\s+(.+)$/;

export const parseNoteMarkdown = (content: string): NoteBlock[] => {
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: "unordered-list" | "ordered-list"; items: NoteInline[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", lines: paragraph.map(parseNoteInline) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const unordered = unorderedItem.exec(line);
    const ordered = orderedItem.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const type = unordered ? "unordered-list" : "ordered-list";
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push(parseNoteInline((unordered ?? ordered)![1]));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
};

export const getNotePlainText = (content: string): string => parseNoteMarkdown(content)
  .flatMap((block) => block.type === "paragraph" ? block.lines : block.items)
  .map((line) => line.map((token) => token.value).join(""))
  .join(" ");

export const getNotePreview = (content: string, maxCharacters = 180): string => {
  const text = getNotePlainText(content).replace(/\s+/g, " ").trim();
  if (text.length <= maxCharacters) return text;
  return `${text.slice(0, maxCharacters).trimEnd()}…`;
};
