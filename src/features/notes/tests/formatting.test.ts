import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveExtensions } from "@tiptap/core";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NoteContent from "../components/NoteContent";
import { getNotePlainText, getNotePreview } from "../lib/note-formatting";
import { noteCreateSchema, noteFormSchema, noteUpdateSchema } from "../zod/schema";

const markdownManager = new MarkdownManager({
  extensions: resolveExtensions([
    StarterKit.configure({ link: { openOnClick: false, autolink: false, linkOnPaste: false }, underline: false, heading: { levels: [2, 3] } }),
    Markdown,
  ]),
});

test("plain text extraction handles rich Markdown without losing punctuation or code literals", () => {
  const content = [
    "## Családi *terv*",
    "",
    "> Szia **család**!",
    "",
    "- ~~tej~~ és `* _ <div>`",
    "- **félkövér _dőlt_**",
    "",
    "```ts",
    'const x = "* _ <div>";',
    "```",
  ].join("\n");

  assert.equal(
    getNotePlainText(content),
    'Családi terv Szia család! tej és * _ <div> félkövér dőlt const x = "* _ <div>";',
  );
  assert.equal(getNotePreview("**Szia**! *Helló*", 11), "Szia! Helló");
});

test("Tiptap Markdown parses and serializes nested marks, headings, quotes, strike, and nested lists", () => {
  const content = [
    "## Bevásárlás",
    "",
    "> Családi **terv**!",
    "",
    "- ~~tej~~",
    "  - *kenyér*",
    "1. **kávé _őrölve_**",
  ].join("\n");
  const parsed = markdownManager.parse(content);
  const savedMarkdown = markdownManager.serialize(parsed);
  const reopened = markdownManager.parse(savedMarkdown);

  assert.equal(getNotePlainText(savedMarkdown), getNotePlainText(content));
  assert.equal(getNotePlainText(markdownManager.serialize(reopened)), getNotePlainText(content));
  assert.match(savedMarkdown, /## Bevásárlás/);
  assert.match(savedMarkdown, /~~tej~~/);
  assert.match(savedMarkdown, /\*kenyér\*/);
});

test("unsupported HTML and unsafe destinations never render as active markup", () => {
  const content = '<img src=x onerror=alert(1)> [oldal](https://example.test) ![kép](https://example.test/photo.png) [rossz](javascript:alert(1))';
  const rendered = renderToStaticMarkup(createElement(NoteContent, { content }));

  assert.doesNotMatch(rendered, /<img\b/);
  assert.doesNotMatch(rendered, /onerror/);
  assert.match(rendered, /<a href="https:\/\/example\.test"/);
  assert.doesNotMatch(rendered, /href="javascript:/);
  assert.match(getNotePreview(content), /oldal/);
  assert.doesNotMatch(getNotePreview(content), /photo\.png|javascript/);
});

test("legacy heading and table content remains visible when its Markdown node is outside the editor schema", () => {
  const content = "# Régi címsor\n\n| Régi | Érték |\n| --- | --- |\n| Lakás | Kész |";
  const rendered = renderToStaticMarkup(createElement(NoteContent, { content }));

  assert.match(rendered, /Régi címsor/);
  assert.match(rendered, /Lakás/);
  assert.doesNotMatch(rendered, /<h1\b|<table\b/);
});

test("notes require visible text and enforce title and content lengths", () => {
  for (const content of [" **_** ", "##", ">", "- ", "```ts\n```", "![csak kép](https://example.test/a.png)", "<img src=x>"]) {
    assert.equal(noteFormSchema.safeParse({ title: "", content, visibility: "private" }).success, false, content);
  }
  assert.equal(noteFormSchema.safeParse({ title: "x".repeat(121), content: "szöveg", visibility: "family" }).success, false);
  assert.equal(noteFormSchema.safeParse({ title: "", content: "x".repeat(5001), visibility: "private" }).success, false);
  assert.equal(noteFormSchema.safeParse({ title: "", content: "## Cím", visibility: "private" }).success, true);
  assert.equal(noteFormSchema.safeParse({ title: "", content: "**Szia**", visibility: "private" }).success, true);
  assert.equal(noteFormSchema.safeParse({ title: "", content: "`* _ <div>`", visibility: "private" }).success, true);
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
