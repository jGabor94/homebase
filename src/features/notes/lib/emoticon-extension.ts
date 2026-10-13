import { Extension, textInputRule } from "@tiptap/core";
import { escapeEmoticonPattern, NOTE_EMOTICONS } from "../utils/note-emoticons";

export const NoteEmoticons = Extension.create({
  name: "noteEmoticons",
  addInputRules() {
    return Object.entries(NOTE_EMOTICONS).map(([emoticon, emoji]) => textInputRule({
      find: new RegExp(`(?:^|[\\s(])(${escapeEmoticonPattern(emoticon)})$`),
      replace: emoji,
    }));
  },
});
