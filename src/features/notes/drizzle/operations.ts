import "server-only";
import { and, arrayContains, asc, count, desc, eq, exists, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { usersTable } from "@/features/user/drizzle/schema";
import { notesTable } from "./schema";
import type { NoteCursorInput, NoteQuery } from "../types";

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

export const getNotesPage = async (userId: string, cursor: NoteCursorInput, query: NoteQuery) => {
  const accessConditions = [
    notesMemberExists(userId),
    or(eq(notesTable.ownerId, userId), eq(notesTable.visibility, "family"))!,
  ];
  const searchCondition = query.query ? or(ilike(notesTable.title, `%${query.query}%`), ilike(notesTable.content, `%${query.query}%`)) : undefined;
  const countConditions = searchCondition ? [...accessConditions, searchCondition] : accessConditions;
  const [countRows, rows] = await Promise.all([
    db.select({ visibility: notesTable.visibility, total: count() }).from(notesTable)
      .where(and(...countConditions)).groupBy(notesTable.visibility),
    (async () => {
      const conditions = [...accessConditions];
      if (searchCondition) conditions.push(searchCondition);
      if (query.filter === "private") conditions.push(eq(notesTable.visibility, "private"));
      if (query.filter === "family") conditions.push(eq(notesTable.visibility, "family"));
      if (cursor) {
        // The DAL rejects mismatched cursors; use the current query as the
        // source of truth so the boundary predicate and ORDER BY cannot diverge.
        const sort = query.sort;
        if (sort === "title") {
          const title = cursor.title ?? null;
          conditions.push(title === null
            ? and(isNull(notesTable.title), sql`${notesTable.id} > ${cursor.id}`)!
            : or(isNull(notesTable.title), sql`${notesTable.title} > ${title}`, and(eq(notesTable.title, title), sql`${notesTable.id} > ${cursor.id}`))!);
        } else {
          const comparison = sort === "oldest" ? sql`${notesTable.updatedAt} > ${cursor.updatedAt}::timestamptz` : sql`${notesTable.updatedAt} < ${cursor.updatedAt}::timestamptz`;
          const tieComparison = sort === "oldest" ? sql`${notesTable.id} > ${cursor.id}` : sql`${notesTable.id} < ${cursor.id}`;
          conditions.push(or(comparison, and(sql`${notesTable.updatedAt} = ${cursor.updatedAt}::timestamptz`, tieComparison))!);
        }
      }
      const orderBy = query.sort === "title"
        ? [sql`${notesTable.title} asc nulls last`, asc(notesTable.id)]
        : query.sort === "oldest"
          ? [asc(notesTable.updatedAt), asc(notesTable.id)]
          : [desc(notesTable.updatedAt), desc(notesTable.id)];
      return db.select(noteProjection).from(notesTable)
        .innerJoin(usersTable, eq(notesTable.ownerId, usersTable.id))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(31);
    })(),
  ]);
  const counts = { all: 0, private: 0, family: 0 };
  for (const row of countRows) counts[row.visibility as "private" | "family"] = row.total;
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
    counts: { ...counts, all: counts.private + counts.family },
    nextCursor: hasMore && lastRow ? {
      updatedAt: lastRow.updatedAtCursor,
      id: lastRow.id,
      sort: query.sort,
      title: lastRow.title,
    } : null,
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
