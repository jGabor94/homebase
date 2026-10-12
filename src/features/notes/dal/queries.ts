import "server-only";
import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { canAccessNotes } from "../lib/access";
import { getNoteById, getNotesPage as getNotesPageQuery } from "../drizzle/operations";
import { noteCardSchema, noteCursorSchema, noteIdSchema, notePageSchema } from "../zod/schema";
import type { NoteActionResult, NoteCard, NoteCursorInput, NotePage } from "../types";
import { z } from "zod";

const genericUnavailable = { type: "note-unavailable", message: "A jegyzet nem érhető el." };
const storageError = { type: "note-storage-error", message: "A jegyzetek most nem tölthetők be. Próbáld újra." };

const notesPageDal = Dal.create({ cache: false }).$Input<[NoteCursorInput]>()
  .schema({ input: z.tuple([noteCursorSchema]), output: notePageSchema })
  .authenticate()
  .operation(async ({ user, input }) => {
    if (!await canAccessNotes(user.id)) return createErrorReturn({ type: "unauthorized" });
    try {
      return createSuccessReturn(await getNotesPageQuery(user.id, input[0]));
    } catch {
      return createErrorReturn(storageError);
    }
  });

export const getNotesPage = async (cursor: NoteCursorInput = null): Promise<NoteActionResult<NotePage>> => {
  try {
    const result = await notesPageDal(cursor);
    if (result?.success) return { success: true, data: result.data };
    if (result && !result.success && result.error.type === "unauthorized") return { success: false, error: { type: "unauthorized", message: "Ehhez a jegyzetfalhoz nincs hozzáférésed." } };
    if (result && !result.success && result.error.type === "unauthenticated") return { success: false, error: { type: "unauthenticated", message: "Jelentkezz be a jegyzetek megtekintéséhez." } };
  } catch { /* Return a safe storage error. */ }
  return { success: false, error: storageError };
};

const noteDal = Dal.create({ cache: false }).$Input<[string]>()
  .schema({ input: z.tuple([noteIdSchema]), output: noteCardSchema })
  .authenticate()
  .operation(async ({ user, input }) => {
    if (!await canAccessNotes(user.id)) return createErrorReturn(genericUnavailable);
    try {
      const note = await getNoteById(user.id, input[0]);
      if (!note) return createErrorReturn(genericUnavailable);
      return createSuccessReturn(note);
    } catch {
      return createErrorReturn(storageError);
    }
  });

export const getNote = async (id: string): Promise<NoteActionResult<NoteCard>> => {
  try {
    const result = await noteDal(id);
    if (result?.success) return { success: true, data: result.data };
    if (result && !result.success && result.error.type === "unauthenticated") return { success: false, error: { type: "unauthenticated", message: "Jelentkezz be a jegyzet megnyitásához." } };
    if (result && !result.success && result.error.type === "note-storage-error") return { success: false, error: storageError };
  } catch { /* Keep unavailable and storage failures intentionally indistinguishable. */ }
  return { success: false, error: genericUnavailable };
};
