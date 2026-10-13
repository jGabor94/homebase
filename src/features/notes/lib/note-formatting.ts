import { marked, type Token } from "marked";

const getTokenText = (token: Token): string => {
  switch (token.type) {
    case "code":
    case "codespan":
    case "escape":
      return token.text;
    case "text":
      if (token.tokens) return getTokensText(token.tokens);
      return !token.escaped && /^[*_~]+$/.test(token.text) ? "" : token.text;
    case "del":
    case "em":
    case "link":
    case "strong":
      return getTokensText(token.tokens ?? []);
    case "heading":
    case "paragraph":
      return getTokensText(token.tokens ?? []);
    case "blockquote":
      return getTokensText(token.tokens ?? [], " ");
    case "list":
      return token.items.map((item: { tokens?: Token[] }) => getTokensText(item.tokens ?? [], " ")).join(" ");
    case "list_item":
      return getTokensText(token.tokens ?? [], " ");
    case "table":
      return [...token.header, ...token.rows.flat()].map((cell) => getTokensText(cell.tokens)).join(" ");
    case "br":
    case "space":
      return " ";
    case "image":
    case "html":
    case "checkbox":
    case "def":
    case "hr":
      return "";
    default:
      return "tokens" in token && token.tokens ? getTokensText(token.tokens) : "";
  }
};

const getTokensText = (tokens: Token[], separator = ""): string => tokens.map(getTokenText).join(separator);

export const getNotePlainText = (content: string): string => getTokensText(marked.lexer(content, { gfm: true }), " ")
  .replace(/\s+/g, " ")
  .trim();

export const getNotePreview = (content: string, maxCharacters = 180): string => {
  const text = getNotePlainText(content);
  if (text.length <= maxCharacters) return text;
  return `${text.slice(0, maxCharacters).trimEnd()}…`;
};
