import assert from "node:assert/strict";
import { test } from "node:test";
import { noteCursorSchema, noteQuerySchema } from "../zod/schema";

const noteId = "00000000-0000-4000-8000-000000000001";

test("note query accepts global-search input and normalizes whitespace", () => {
  assert.deepEqual(noteQuerySchema.parse({ search: "  heti menü  ", filter: "family", sort: "title" }), {
    query: "heti menü",
    filter: "family",
    sort: "title",
  });
  assert.deepEqual(noteQuerySchema.parse({}), { query: "", filter: "all", sort: "latest" });
});

test("note query enforces supported filter, sort, and search length", () => {
  assert.equal(noteQuerySchema.safeParse({ filter: "owners" }).success, false);
  assert.equal(noteQuerySchema.safeParse({ sort: "random" }).success, false);
  assert.equal(noteQuerySchema.safeParse({ search: "x".repeat(121) }).success, false);
});

test("cursor schema preserves the legacy timestamp/id cursor contract", () => {
  assert.deepEqual(noteCursorSchema.parse({ updatedAt: "2026-10-12T08:00:00.000Z", id: noteId }), {
    updatedAt: "2026-10-12T08:00:00.000Z",
    id: noteId,
  });
});

test("title-sort cursors preserve null-title boundaries", () => {
  const cursor = { updatedAt: "2026-10-12T08:00:00.000Z", id: noteId, sort: "title" as const, title: null };
  assert.deepEqual(noteCursorSchema.parse(cursor), cursor);
  assert.equal(noteCursorSchema.safeParse({ ...cursor, title: 42 }).success, false);
});
