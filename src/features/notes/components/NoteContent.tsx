import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FC } from "react";
import { convertNoteEmoticons } from "../utils/note-emoticons";

interface NoteContentProps {
  content: string;
  compact?: boolean;
}

const safeUrlTransform = (value: string): string => {
  if (value.startsWith("//") || value.startsWith("\\\\")) return "";
  try {
    const url = new URL(value, "https://homebase.invalid");
    if (["https:", "http:", "mailto:"].includes(url.protocol)) return value;
    return "";
  } catch {
    return "";
  }
};

const markdownComponents: Components = {
  a: ({ href, title, children }) => <a href={href} title={title} rel="noopener noreferrer" target="_blank">{children}</a>,
  img: () => null,
  input: () => null,
};

const compactMarkdownComponents: Components = {
  ...markdownComponents,
  a: ({ children }) => <span>{children}</span>,
};

const NoteContent: FC<NoteContentProps> = ({ content, compact = false }) => (
  <div className={`break-words [overflow-wrap:anywhere] ${compact ? "line-clamp-4 max-h-32 overflow-hidden" : ""} [&_a]:text-primary [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h2]:my-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:my-2 [&_ol]:list-decimal [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc`}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={["a", "blockquote", "br", "code", "del", "em", "h2", "h3", "hr", "li", "ol", "p", "pre", "strong", "ul"]}
      unwrapDisallowed
      skipHtml
      urlTransform={safeUrlTransform}
      components={compact ? compactMarkdownComponents : markdownComponents}
    >
      {convertNoteEmoticons(content)}
    </ReactMarkdown>
  </div>
);

export default NoteContent;
