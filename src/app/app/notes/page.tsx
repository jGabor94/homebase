import type { FC } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppPageHeader from "@/components/AppPageHeader";
import { auth } from "@/features/authentication/lib/auth";
import { getNotesPage } from "@/features/notes/dal/queries";
import NoteBoard from "@/features/notes/components/NoteBoard";
import { canAccessNotes } from "@/features/notes/lib/access";
import { noteIdSchema, noteQuerySchema } from "@/features/notes/zod/schema";

export const metadata: Metadata = { title: "Jegyzetek · homebase" };

interface NotesPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const NotesPage: FC<NotesPageProps> = async ({ searchParams }) => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!await canAccessNotes(session.user.id)) redirect("/app");

  const params = await searchParams;
  const parsedQuery = noteQuerySchema.safeParse({ query: params.q, filter: params.filter, sort: params.sort });
  const initialQuery = parsedQuery.success ? parsedQuery.data : noteQuerySchema.parse({});
  const noteId = typeof params.note === "string" && noteIdSchema.safeParse(params.note).success ? params.note : undefined;
  const startNew = params.new === "1" && !noteId;
  const result = await getNotesPage(null, initialQuery);
  const initialPage = result.success ? result.data : null;
  const initialError = result.success ? undefined : result.error.message;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
      <AppPageHeader title="Jegyzetek" description="A család ötletei, teendői és fontos emlékeztetői egy helyen." illustration="notes" />
      <NoteBoard initialPage={initialPage} userId={session.user.id} userName={session.user.name} initialError={initialError} initialQuery={initialQuery} initialNoteId={noteId} startNew={startNew} />
    </main>
  );
};

export default NotesPage;
