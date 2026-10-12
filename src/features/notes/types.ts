import { z } from "zod";
import { notesTable } from "./drizzle/schema";
import { noteCardSchema, noteCreateSchema, noteCursorSchema, noteDeleteSchema, noteFormSchema, notePageSchema, noteUpdateSchema } from "./zod/schema";

export type InsertNote = typeof notesTable.$inferInsert;
export type SelectNote = typeof notesTable.$inferSelect;
export type NoteFormInput = z.input<typeof noteFormSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type NoteDeleteInput = z.infer<typeof noteDeleteSchema>;
export type NoteCursorInput = z.infer<typeof noteCursorSchema>;
export type NoteCard = z.infer<typeof noteCardSchema>;
export type NotePage = z.infer<typeof notePageSchema>;
export type NoteList = Awaited<ReturnType<typeof import("./drizzle/operations").getNotesPage>>;
export type NoteListItem = NoteList["notes"][number];
export type NoteActionResult<T> = { success: true; data: T } | { success: false; error: { type: string; message: string } };
