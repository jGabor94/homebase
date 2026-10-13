import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NoteContent from "../components/NoteContent";
import { NoteEmoticons } from "../lib/emoticon-extension";
import { convertNoteEmoticons } from "../utils/note-emoticons";
import { noteCreateSchema, noteFormSchema, noteUpdateSchema } from "../zod/schema";

test("common smileys convert without consuming whitespace or punctuation", () => {
  assert.equal(convertNoteEmoticons("Szia :D :) ;) :( :P :O :'( <3"), "Szia 😄 😊 😉 😞 😛 😮 😢 ❤️");
  assert.equal(convertNoteEmoticons("**:D**! (:-))\n;-D"), "**😄**! (😊)\n;-D");
  assert.equal(convertNoteEmoticons("C:Dokumentum nem:D :Document"), "C:Dokumentum nem:D :Document");
});

test("code and link destinations stay literal", () => {
  const content = "`:D`\n```\n:)\n```\n[oldal](https://example.test/:D) https://example.test/:D :D";
  assert.equal(convertNoteEmoticons(content), content.slice(0, -2) + "😄");
  assert.equal(convertNoteEmoticons("```\n:D"), "```\n:D");
});

test("create, update and form submissions normalize pasted smileys", () => {
  const fields = { title: "", content: "Beillesztett :D", visibility: "private" as const };
  const parsed = noteFormSchema.parse(fields);
  assert.equal(parsed.content, "Beillesztett 😄");
  assert.equal(noteCreateSchema.parse(fields).content, parsed.content);
  assert.equal(noteUpdateSchema.parse({ ...fields, id: "00000000-0000-4000-8000-000000000001", expectedVersion: 1 }).content, parsed.content);
});

test("stored legacy smileys render as emoji", () => {
  const rendered = renderToStaticMarkup(createElement(NoteContent, { content: "Szia :D" }));
  assert.match(rendered, /Szia 😄/);
  assert.doesNotMatch(rendered, /:D/);
});

test("typing rules capture only the smiley at the cursor", () => {
  const rules = NoteEmoticons.config.addInputRules?.call({} as never) ?? [];
  const rule = rules.find((item) => item.find instanceof RegExp && item.find.test("Szia :D"));
  assert.ok(rule);
  assert.ok(rule.find instanceof RegExp);
  assert.equal(rule.find.exec("Szia :D")?.[1], ":D");
  assert.equal(rule.find.test("nem:D"), false);
});
