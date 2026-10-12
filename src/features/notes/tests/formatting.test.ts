import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NoteContent from "../components/NoteContent";
import { getNotePlainText, getNotePreview, parseNoteMarkdown } from "../lib/note-formatting";
import { noteCreateSchema, noteFormSchema, noteUpdateSchema } from "../zod/schema";

test("limited markdown parses emphasis, paragraphs, line breaks, and one-level lists", () => {
  const blocks = parseNoteMarkdown("Szia **család**!\nMásodik sor\n\n- tej\n- *kenyér*");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.type, "paragraph");
  assert.equal(blocks[1]?.type, "unordered-list");
  assert.equal(getNotePlainText("Szia **család**!\n- tej"), "Szia család! tej");
});

test("unsupported HTML and links stay literal text, never become markup", () => {
  const content = "<img src=x onerror=alert(1)> [oldal](https://example.test)";
  assert.deepEqual(parseNoteMarkdown(content), [{ type: "paragraph", lines: [[{ type: "text", value: content }]] }]);
  assert.match(getNotePreview(content), /^<img/);
  const rendered = renderToStaticMarkup(createElement(NoteContent, { content }));
  assert.match(rendered, /&lt;img/);
  assert.doesNotMatch(rendered, /<img\b/);
  assert.doesNotMatch(rendered, /<a\b/);
});

test("notes require visible text and enforce title and content lengths", () => {
  assert.equal(noteFormSchema.safeParse({ title: "", content: " **_** ", visibility: "private" }).success, false);
  assert.equal(noteFormSchema.safeParse({ title: "x".repeat(121), content: "szöveg", visibility: "family" }).success, false);
  assert.equal(noteFormSchema.safeParse({ title: "", content: "x".repeat(5001), visibility: "private" }).success, false);
  assert.equal(noteFormSchema.safeParse({ title: "", content: "**Szia**", visibility: "private" }).success, true);
});

test("titleless form output remains valid for create and update actions", () => {
  const formValues = { title: "", content: "Szia", visibility: "private" as const };
  const parsedForm = noteFormSchema.parse(formValues);
  assert.equal(parsedForm.title, null);
  assert.equal(noteCreateSchema.safeParse(parsedForm).success, true);
  assert.equal(noteUpdateSchema.safeParse({ ...parsedForm, id: "00000000-0000-4000-8000-000000000001", expectedVersion: 1 }).success, true);

  const forgedCreate = noteCreateSchema.parse({ ...parsedForm, ownerId: "attacker", id: "00000000-0000-4000-8000-000000000002", version: 99 });
  assert.deepEqual(forgedCreate, parsedForm);
  const forgedUpdate = noteUpdateSchema.parse({ ...parsedForm, id: "00000000-0000-4000-8000-000000000001", expectedVersion: 1, ownerId: "attacker", createdAt: "1999-01-01T00:00:00.000Z" });
  assert.deepEqual(forgedUpdate, { ...parsedForm, id: "00000000-0000-4000-8000-000000000001", expectedVersion: 1 });

  const longTitle = { ...parsedForm, title: "x".repeat(121) };
  assert.equal(noteCreateSchema.safeParse(longTitle).success, false);
  assert.equal(noteUpdateSchema.safeParse({ ...longTitle, id: "00000000-0000-4000-8000-000000000001", expectedVersion: 1 }).success, false);
});
