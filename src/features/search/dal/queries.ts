import "server-only";
import { getNotesPage } from "@/features/notes/dal/queries";
import { searchMonthlyExpenses } from "@/features/monthly-expenses/dal/search";
import type { GlobalSearchItem, GlobalSearchQuery, GlobalSearchResponse } from "../types";

const formatReportMonth = (reportMonth: string) => {
  const [year, month] = reportMonth.split("-").map(Number);
  return new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "Europe/Budapest" })
    .format(new Date(Date.UTC(year, month - 1, 15, 12)));
};

const noteExcerpt = (content: string) => {
  const excerpt = content.replace(/[*_#]/g, "").replace(/\s+/g, " ").trim();
  return excerpt.length > 110 ? `${excerpt.slice(0, 107)}…` : excerpt;
};

const unavailableGroup = (message: string) => ({ items: [] as GlobalSearchItem[], error: message });
const hiddenGroup = { items: [] as GlobalSearchItem[], error: null };
const isAccessFailure = (error: { type: string }) => error.type === "unauthenticated" || error.type === "unauthorized";

export const searchHomebase = async (query: GlobalSearchQuery): Promise<GlobalSearchResponse> => {
  const [notesResult, expensesResult] = await Promise.allSettled([
    getNotesPage(null, { search: query }),
    searchMonthlyExpenses(query),
  ]);

  const notes = notesResult.status === "fulfilled"
    ? notesResult.value.success
      ? {
        items: notesResult.value.data.notes.slice(0, 10).map((note) => ({
          id: note.id,
          title: note.title || "Cím nélküli jegyzet",
          description: noteExcerpt(note.content),
          href: `/app/notes?note=${encodeURIComponent(note.id)}`,
          updatedAt: note.updatedAt,
        })),
        error: null,
      }
      : isAccessFailure(notesResult.value.error) ? hiddenGroup : unavailableGroup(notesResult.value.error.message)
    : unavailableGroup("A jegyzetkeresés most nem érhető el.");

  const monthlyExpenses = expensesResult.status === "fulfilled"
    ? expensesResult.value.success
      ? {
        items: expensesResult.value.data.slice(0, 10).map((report) => ({
          id: report.reportMonth,
          title: formatReportMonth(report.reportMonth),
          description: [report.providerName, report.invoiceNumber].filter(Boolean).join(" · ") || "Mentett havi kimutatás",
          href: `/app/monthly-expenses?month=${encodeURIComponent(report.reportMonth)}`,
          updatedAt: report.updatedAt,
        })),
        error: null,
      }
      : isAccessFailure(expensesResult.value.error) ? hiddenGroup : unavailableGroup(expensesResult.value.error.message)
    : unavailableGroup("A közműkimutatások keresése most nem érhető el.");

  return { notes, monthlyExpenses };
};
