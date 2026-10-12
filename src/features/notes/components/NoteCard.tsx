import { CalendarDays, LockKeyhole, UsersRound } from "lucide-react";
import type { FC } from "react";
import type { NoteCard as NoteCardData } from "../types";
import NoteContent from "./NoteContent";

interface NoteCardProps {
  note: NoteCardData;
  onOpen: () => void;
}

const colors = ["bg-note-yellow", "bg-note-peach", "bg-note-sage"];
const noteColorIndex = (id: string) => [...id].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7) % colors.length;

const NoteCard: FC<NoteCardProps> = ({ note, onOpen }) => {
  const dateLabel = new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeZone: "Europe/Budapest" }).format(new Date(note.updatedAt));
  const titleId = `note-title-${note.id}`;
  const previewId = `note-preview-${note.id}`;
  const detailsId = `note-details-${note.id}`;
  const authorId = `note-author-${note.id}`;

  return (
    <article className={`group relative flex min-h-64 flex-col overflow-hidden rounded-xl border border-border/80 p-5 pt-7 shadow-sm transition-shadow hover:shadow-md ${colors[noteColorIndex(note.id)]}`}>
      <button type="button" onClick={onOpen} aria-labelledby={`${titleId} ${detailsId} ${authorId}`} aria-describedby={previewId} className="absolute inset-0 z-10 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-4 w-16 -translate-x-1/2 rounded-b-sm bg-white/55 shadow-sm" />
      <div id={detailsId} className="pointer-events-none mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
        <span className="inline-flex items-center gap-1.5">{note.visibility === "family" ? <UsersRound className="size-4" /> : <LockKeyhole className="size-4" />}{note.visibility === "family" ? "Családdal megosztott" : "Privát"}</span>
        <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" />{dateLabel}</span>
      </div>
      <h2 id={titleId} className="pointer-events-none mb-3 break-words font-serif text-xl font-semibold text-foreground [overflow-wrap:anywhere]">{note.title || "Cím nélküli jegyzet"}</h2>
      <div id={previewId} className="pointer-events-none flex-1 overflow-hidden text-sm leading-6 text-foreground/90"><NoteContent content={note.content} compact maxCharacters={180} /></div>
      <div id={authorId} className="pointer-events-none mt-5 break-words border-t border-foreground/10 pt-3 text-xs text-muted-foreground [overflow-wrap:anywhere]">{note.ownerName || "Családtag"}</div>
    </article>
  );
};

export default NoteCard;
