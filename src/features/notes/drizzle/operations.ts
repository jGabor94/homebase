import "server-only";
import { and, arrayContains, desc, eq, exists, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { usersTable } from "@/features/user/drizzle/schema";
import { notesTable } from "./schema";
import type { NoteCursorInput } from "../types";

const notesMemberExists = (userId: string) => exists(
  db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, userId), arrayContains(usersTable.roles, ["notesMember"]))),
);

const noteProjection = {
  id: notesTable.id,
  ownerId: notesTable.ownerId,
  ownerName: usersTable.name,
  title: notesTable.title,
  content: notesTable.content,
  visibility: notesTable.visibility,
  version: notesTable.version,
  createdAt: notesTable.createdAt,
  updatedAt: notesTable.updatedAt,
  updatedAtCursor: sql<string>`to_char(${notesTable.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
};

export const getNotesPage = async (userId: string, cursor: NoteCursorInput) => {
  const conditions = [
    notesMemberExists(userId),
    or(eq(notesTable.ownerId, userId), eq(notesTable.visibility, "family"))!,
  ];
  if (cursor) {
    conditions.push(or(sql`${notesTable.updatedAt} < ${cursor.updatedAt}::timestamptz`, and(sql`${notesTable.updatedAt} = ${cursor.updatedAt}::timestamptz`, sql`${notesTable.id} < ${cursor.id}`))!);
  }
  const rows = await db.select(noteProjection).from(notesTable)
    .innerJoin(usersTable, eq(notesTable.ownerId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(notesTable.updatedAt), desc(notesTable.id))
    .limit(31);
  const hasMore = rows.length > 30;
  const notes = rows.slice(0, 30).map((note) => ({
    id: note.id,
    ownerId: note.ownerId,
    ownerName: note.ownerName,
    title: note.title,
    content: note.content,
    visibility: note.visibility,
    version: note.version,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }));
  const lastRow = rows[Math.min(29, rows.length - 1)];
  return {
    notes,
    nextCursor: hasMore && lastRow ? { updatedAt: lastRow.updatedAtCursor, id: lastRow.id } : null,
  };
};

export const getNoteById = async (userId: string, id: string) => {
  const [note] = await db.select(noteProjection).from(notesTable)
    .innerJoin(usersTable, eq(notesTable.ownerId, usersTable.id))
    .where(and(
      notesMemberExists(userId),
      eq(notesTable.id, id),
      or(eq(notesTable.ownerId, userId), eq(notesTable.visibility, "family")),
    )).limit(1);
  if (!note) return null;
  return { id: note.id, ownerId: note.ownerId, ownerName: note.ownerName, title: note.title, content: note.content,
    visibility: note.visibility, version: note.version, createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() };
};

export const hasNotesMemberRole = notesMemberExists;
