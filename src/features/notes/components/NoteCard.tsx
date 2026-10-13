import { DropdownMenu } from "radix-ui";
import { CalendarDays, LockKeyhole, MoreHorizontal, Pencil, Trash2, UsersRound } from "lucide-react";
import { type FC } from "react";
import type { NoteCard as NoteCardData } from "../types";
import NoteContent from "./NoteContent";

interface NoteCardProps {
  note: NoteCardData;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  list?: boolean;
}

const colors = ["#f0f5e8", "#fff0ed", "#eef7f2", "#edf5fb", "#fff6e7"];
const noteColorIndex = (id: string) => [...id].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7) % colors.length;

const NoteCard: FC<NoteCardProps> = ({ note, onOpen, onEdit, onDelete, canEdit, list = false }) => {
  const dateLabel = new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeZone: "Europe/Budapest" }).format(new Date(note.updatedAt));
  const titleId = `note-title-${note.id}`;
  const detailsId = `note-details-${note.id}`;
  const authorName = note.ownerName || "Családtag";
  const initials = authorName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("hu-HU")).join("") || "?";

  return (
    <article className={`group relative min-w-0 overflow-hidden rounded-[20px] border border-border/80 shadow-sm transition-shadow hover:shadow-md ${list ? "min-h-32" : "min-h-60"}`} style={{ backgroundColor: colors[noteColorIndex(note.id)] }}>
      <button type="button" onClick={onOpen} aria-labelledby={`${titleId} ${detailsId}`} className={`flex h-full w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${list ? "gap-3 p-4 pr-14 sm:flex-row sm:items-center sm:gap-5" : "p-5 pr-14"}`}>
        <div className={`flex min-w-0 flex-wrap items-center gap-2 text-xs ${list ? "sm:w-56 sm:shrink-0" : "justify-between"}`} id={detailsId}>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${note.visibility === "family" ? "bg-[#dff3eb] text-[#087b45]" : "bg-white/70 text-[#526174]"}`}>
            {note.visibility === "family" ? <UsersRound aria-hidden="true" className="size-3.5" /> : <LockKeyhole aria-hidden="true" className="size-3.5" />}
            {note.visibility === "family" ? "Megosztott" : "Privát"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CalendarDays aria-hidden="true" className="size-3.5" />{dateLabel}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="mb-2 break-words text-lg font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{note.title || "Cím nélküli jegyzet"}</h2>
          <div className="line-clamp-4 overflow-hidden text-sm leading-6 text-foreground/85"><NoteContent content={note.content} compact maxCharacters={list ? 250 : 180} /></div>
        </div>
        <div className={`flex items-center gap-2 text-xs text-muted-foreground ${list ? "sm:w-40 sm:shrink-0" : "mt-auto border-t border-foreground/10 pt-4"}`}>
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-[#126574] text-xs font-semibold text-white">{initials}</span>
          <span className="truncate">{authorName}</span>
        </div>
      </button>
      {canEdit && <div className="absolute right-2 top-2 z-10">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label={`${note.title || "Cím nélküli jegyzet"} műveletei`} className="grid size-11 place-items-center rounded-full text-foreground/70 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><MoreHorizontal aria-hidden="true" className="size-5" /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="z-50 grid min-w-44 gap-1 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none">
              <DropdownMenu.Item onSelect={onEdit} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm outline-none focus:bg-muted"><Pencil aria-hidden="true" className="size-4" />Szerkesztés</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onDelete} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-destructive outline-none focus:bg-destructive/5"><Trash2 aria-hidden="true" className="size-4" />Törlés</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>}
    </article>
  );
};

export default NoteCard;
