import { Fragment, type FC } from "react";
import { getNotePlainText, parseNoteMarkdown, type NoteBlock, type NoteInline } from "../lib/note-formatting";

interface NoteContentProps {
  content: string;
  compact?: boolean;
  maxCharacters?: number;
}

const renderInline = (tokens: NoteInline[]) => tokens.map((token, index) => {
  if (token.type === "bold") return <strong key={index} className="font-semibold">{token.value}</strong>;
  if (token.type === "italic") return <em key={index}>{token.value}</em>;
  return <Fragment key={index}>{token.value}</Fragment>;
});

const clipBlocks = (blocks: NoteBlock[], maxCharacters: number): NoteBlock[] => {
  let remaining = maxCharacters;
  const clipped: NoteBlock[] = [];
  for (const block of blocks) {
    if (remaining <= 0) break;
    const lines = block.type === "paragraph" ? block.lines : block.items;
    const nextLines = [];
    for (const line of lines) {
      if (remaining <= 0) break;
      const nextLine: NoteInline[] = [];
      for (const token of line) {
        if (remaining <= 0) break;
        const value = token.value.slice(0, remaining);
        if (value) nextLine.push({ ...token, value });
        remaining -= value.length;
      }
      if (nextLine.length) nextLines.push(nextLine);
    }
    if (nextLines.length) clipped.push(block.type === "paragraph" ? { type: "paragraph", lines: nextLines } : { type: block.type, items: nextLines });
  }
  return clipped;
};

const NoteContent: FC<NoteContentProps> = ({ content, compact = false, maxCharacters }) => {
  const parsed = parseNoteMarkdown(content);
  const blocks = maxCharacters ? clipBlocks(parsed, maxCharacters) : parsed;
  const truncated = maxCharacters !== undefined && getNotePlainText(content).length > maxCharacters;

  return (
    <div className={`break-words [overflow-wrap:anywhere] ${compact ? "max-h-32 overflow-hidden" : ""}`}>
      {blocks.map((block, index) => {
        if (block.type === "unordered-list") return <ul key={index} className="my-2 list-disc pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ul>;
        if (block.type === "ordered-list") return <ol key={index} className="my-2 list-decimal pl-5">{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</ol>;
        return <p key={index} className="my-2 first:mt-0 last:mb-0">{block.lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}{renderInline(line)}</Fragment>)}</p>;
      })}
      {truncated && <span aria-hidden="true">…</span>}
    </div>
  );
};

export default NoteContent;
