import type { FC } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/authentication/lib/auth";
import { canAccessNotes } from "@/features/notes/lib/access";
import { getNotesPage } from "@/features/notes/dal/queries";
import NoteBoard from "@/features/notes/components/NoteBoard";

export const metadata: Metadata = { title: "Jegyzetek · homebase" };

const NotesPage: FC = async () => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!await canAccessNotes(session.user.id)) redirect("/app");

  const result = await getNotesPage();
  const initialPage = result.success ? result.data : null;
  const initialError = result.success ? undefined : result.error.message;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
      <section className="mb-6">
        <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground">Jegyzetek</h1>
        <p className="mt-1 max-w-2xl text-base leading-6 text-muted-foreground">A saját és közös cetlijeink.</p>
      </section>
      <NoteBoard initialPage={initialPage} userId={session.user.id} initialError={initialError} />
    </main>
  );
};

export default NotesPage;
