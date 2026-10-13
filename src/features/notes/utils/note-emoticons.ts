export const NOTE_EMOTICONS = {
  ":D": "😄", ":-D": "😄",
  ":)": "😊", ":-)": "😊",
  ";)": "😉", ";-)": "😉",
  ":(": "😞", ":-(": "😞",
  ":P": "😛", ":-P": "😛", ":p": "😛", ":-p": "😛",
  ":O": "😮", ":-O": "😮", ":o": "😮", ":-o": "😮",
  ":'(": "😢", "<3": "❤️",
} as const;

export const escapeEmoticonPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const emoticonPattern = new RegExp(
  `(^|[\\s([*_])(${Object.keys(NOTE_EMOTICONS).map(escapeEmoticonPattern).join("|")})(?=$|[\\s.,!?;)\\]*_])`,
  "g",
);

// Keep code and link destinations literal when normalizing stored Markdown.
const protectedMarkdown = /(```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`+[^`]*`+|(?:https?:\/\/|mailto:)\S+|\]\([^\n)]*\))/g;

export const convertNoteEmoticons = (content: string): string => content.split(protectedMarkdown)
  .map((part, index) => index % 2 ? part : part.replace(emoticonPattern, (_match, prefix: string, emoticon: string) =>
    prefix + NOTE_EMOTICONS[emoticon as keyof typeof NOTE_EMOTICONS],
  ))
  .join("");
