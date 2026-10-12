"use server";

import { and, eq } from "drizzle-orm";
import { arrayContains } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { usersTable } from "@/features/user/drizzle/schema";
import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { hasNotesMemberRole } from "../drizzle/operations";
import { notesTable } from "../drizzle/schema";
import { getNoteById } from "../drizzle/operations";
import { hasFreshNotesPermission } from "../lib/access";
import { noteCardSchema, noteCreateSchema, noteDeleteSchema, noteUpdateSchema } from "../zod/schema";
import type { NoteActionResult, NoteCard, NoteCreateInput, NoteDeleteInput, NoteUpdateInput } from "../types";

const storageError = { type: "note-storage-error", message: "A jegyzet most nem menthető. Próbáld újra." };
const unavailableError = { type: "note-unavailable", message: "A jegyzet nem érhető el." };
const conflictError = { type: "note-version-conflict", message: "Ezt a jegyzetet közben máshol módosították. A helyi szöveged megmaradt; töltsd be a frissebb változatot, vagy másold ki a sajátodat." };

const createNoteDal = Dal.create({ cache: false }).$Input<[NoteCreateInput]>()
  .schema({ input: z.tuple([noteCreateSchema]), output: noteCardSchema })
  .authenticate()
  .operation(async ({ user, input }) => {
    if (!await hasFreshNotesPermission(user.id, "create")) return createErrorReturn({ type: "unauthorized" });
    try {
      const fields = noteCreateSchema.parse(input[0]);
      const created = await db.transaction(async (transaction) => {
        const [activeMember] = await transaction.select({ id: usersTable.id })
          .from(usersTable)
          .where(and(eq(usersTable.id, user.id), arrayContains(usersTable.roles, ["notesMember"])))
          .for("update").limit(1);
        if (!activeMember) return undefined;
        const [row] = await transaction.insert(notesTable).values({
          id: crypto.randomUUID(), ownerId: user.id, ...fields, title: fields.title || null, version: 1,
        }).returning({ id: notesTable.id });
        return row;
      });
      if (!created) return createErrorReturn(storageError);
      const note = await getNoteById(user.id, created.id);
      return note ? createSuccessReturn(note) : createErrorReturn(unavailableError);
    } catch {
      return createErrorReturn(storageError);
    }
  });

const updateNoteDal = Dal.create({ cache: false }).$Input<[NoteUpdateInput]>()
  .schema({ input: z.tuple([noteUpdateSchema]), output: noteCardSchema })
  .authenticate()
  .operation(async ({ user, input }) => {
    if (!await hasFreshNotesPermission(user.id, "update")) return createErrorReturn({ type: "unauthorized" });
    try {
      const parsedInput = noteUpdateSchema.parse(input[0]);
      const { id, expectedVersion, ...fields } = parsedInput;
      const [updated] = await db.update(notesTable).set({ ...fields, title: fields.title || null, version: expectedVersion + 1, updatedAt: new Date() })
        .where(and(eq(notesTable.id, id), eq(notesTable.ownerId, user.id), eq(notesTable.version, expectedVersion), hasNotesMemberRole(user.id)))
        .returning({ id: notesTable.id });
      if (!updated) {
        const [owned] = await db.select({ id: notesTable.id, version: notesTable.version }).from(notesTable)
          .where(and(eq(notesTable.id, id), eq(notesTable.ownerId, user.id), hasNotesMemberRole(user.id))).limit(1);
        return owned ? createErrorReturn(conflictError) : createErrorReturn(unavailableError);
      }
      const note = await getNoteById(user.id, id);
      return note ? createSuccessReturn(note) : createErrorReturn(unavailableError);
    } catch {
      return createErrorReturn(storageError);
    }
  });

const deleteNoteDal = Dal.create({ cache: false }).$Input<[NoteDeleteInput]>()
  .schema({ input: z.tuple([noteDeleteSchema]), output: z.object({ id: z.string().uuid() }) })
  .authenticate()
  .operation(async ({ user, input }) => {
    if (!await hasFreshNotesPermission(user.id, "delete")) return createErrorReturn({ type: "unauthorized" });
    const { id, expectedVersion } = input[0];
    try {
      const [deleted] = await db.delete(notesTable)
        .where(and(eq(notesTable.id, id), eq(notesTable.ownerId, user.id), eq(notesTable.version, expectedVersion), hasNotesMemberRole(user.id)))
        .returning({ id: notesTable.id });
      if (!deleted) {
        const [owned] = await db.select({ id: notesTable.id, version: notesTable.version }).from(notesTable)
          .where(and(eq(notesTable.id, id), eq(notesTable.ownerId, user.id), hasNotesMemberRole(user.id))).limit(1);
        return owned ? createErrorReturn(conflictError) : createErrorReturn(unavailableError);
      }
      return createSuccessReturn({ id });
    } catch {
      return createErrorReturn(storageError);
    }
  });

const publicFailure = (result: { success: false; error: { type: string } } | undefined) => {
  if (result?.error.type === "unauthenticated") return { type: "unauthenticated", message: "Jelentkezz be a jegyzetek használatához." };
  if (result?.error.type === "unauthorized") return { type: "unauthorized", message: "Ehhez a jegyzetfalhoz nincs hozzáférésed." };
  if (result?.error.type === "note-version-conflict") return conflictError;
  if (result?.error.type === "note-unavailable") return unavailableError;
  if (result?.error.type === "zod-input-error" || result?.error.type === "validation-error") return { type: "validation-error", message: "Ellenőrizd a jegyzet címét, szövegét és láthatóságát." };
  return storageError;
};

export async function loadNote(id: string) {
  const { getNote } = await import("./queries");
  return getNote(id);
}

export async function loadNotesPage(cursor: import("../types").NoteCursorInput = null) {
  const { getNotesPage } = await import("./queries");
  return getNotesPage(cursor);
}

export const createNote = async (input: NoteCreateInput): Promise<NoteActionResult<NoteCard>> => {
  try {
    const result = await createNoteDal(input);
    if (result?.success) {
      revalidatePath("/app/notes");
      return { success: true, data: result.data };
    }
    return { success: false, error: publicFailure(result) };
  } catch { return { success: false, error: storageError }; }
};

export const updateNote = async (input: NoteUpdateInput): Promise<NoteActionResult<NoteCard>> => {
  try {
    const result = await updateNoteDal(input);
    if (result?.success) {
      revalidatePath("/app/notes");
      return { success: true, data: result.data };
    }
    return { success: false, error: publicFailure(result) };
  } catch { return { success: false, error: storageError }; }
};

export const deleteNote = async (input: NoteDeleteInput): Promise<NoteActionResult<{ id: string }>> => {
  try {
    const result = await deleteNoteDal(input);
    if (result?.success) {
      revalidatePath("/app/notes");
      return { success: true, data: result.data };
    }
    return { success: false, error: publicFailure(result) };
  } catch { return { success: false, error: storageError }; }
};
