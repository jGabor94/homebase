"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ChevronLeft, ChevronRight, FilePenLine, FileUp, LoaderCircle, Mail, Plus, Trash2 } from "lucide-react";
import AppCreationBar from "@/components/AppCreationBar";
import { startTransition, useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type FC, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { FormProvider, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import toast from "react-hot-toast";
import Image from "next/image";
import { useNavigationGuard } from "@/providers/NavigationGuardProvider";
import { INVOICE_CATEGORY_LABELS, MAX_UPLOAD_BYTES, UTILITY_CATEGORY_LOGOS } from "../config";
import { connectGmail } from "../dal/connection";
import { collectGmailInvoices, importGmailInvoice } from "../dal/mutations";
import { deleteMonthlyExpenseReport, loadMonthlyExpenseReport, saveMonthlyExpenseReport } from "../dal/mutations";
import { loadExpensePresets } from "../dal/presets";
import type { ExpensePresetDto, GmailCandidate, GmailDocumentReference, InvoiceReportInput, InvoiceRowInput, InvoiceSource, MonthlyExpenseReportItem, MonthlyExpenseReportLoaded } from "../types";
import { createEmptyInvoice, getInvoiceMergeKeys, mergeImportedInvoices, summarizeInvoices } from "../utils";
import { createAdditionalItemFromPreset, createDefaultAdditionalItems } from "../utils/expense-presets";
import { formatMinorAsHuf } from "../utils/money";
import { createSummaryExportSnapshot } from "../utils/summary-export";
import { invoiceReportFormSchema } from "../zod/schema";
import { formatMinorAsHuf as formatReportTotal } from "../utils/money";
import AdditionalExpenseRow from "./AdditionalExpenseRow";
import ExpenseSummaryExportDialog from "./ExpenseSummaryExportDialog";
import InvoiceRowCard from "./InvoiceRowCard";
import SourcePreviewDialog from "./SourcePreviewDialog";
import UtilityHistoryChart from "./UtilityHistoryChart";
import { buildUtilityHistoryMonth } from "../utils/consumption";
import type { UtilityHistoryMonth } from "../types";

type ImportPhase = "searching" | "processing-gmail" | "uploading" | "connecting" | null;

interface MonthlyExpensesFormProps {
  overviewHeader: ReactNode;
  initialMonth: string;
  initialGmailConnected: boolean;
  initialExpensePresets: ExpensePresetDto[];
  initialPresetsError: string | null;
  initialStoredReports: MonthlyExpenseReportItem[];
  initialStoredReportsError: string | null;
  initialUtilityHistory: UtilityHistoryMonth[];
  initialUtilityHistoryError: string | null;
  requestedMonth: string | null;
  initialRequestedReport: MonthlyExpenseReportLoaded | null;
  initialRequestedReportError: string | null;
  initialIntent: "invoice" | null;
}

const formatMonth = (monthKey: string) => new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", timeZone: "UTC" })
  .format(new Date(`${monthKey}-01T12:00:00Z`));

const readError = (result: unknown) => {
  if (result && typeof result === "object" && "error" in result) {
    const error = result.error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  }
  if (result && typeof result === "object" && "message" in result && typeof result.message === "string") return result.message;
  return "A művelet most nem sikerült. Próbáld újra, vagy vidd fel kézzel a számlát.";
};

const runWithConcurrency = async <T,>(items: T[], concurrency: number, operation: (item: T) => Promise<void>, shouldContinue: () => boolean = () => true) => {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length && shouldContinue()) {
      const item = items[nextIndex];
      nextIndex += 1;
      await operation(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
};

const MonthlyExpensesForm: FC<MonthlyExpensesFormProps> = ({ overviewHeader, initialMonth, initialGmailConnected, initialExpensePresets, initialPresetsError, initialStoredReports, initialStoredReportsError, initialUtilityHistory, initialUtilityHistoryError, requestedMonth, initialRequestedReport, initialRequestedReportError, initialIntent }) => {
  const router = useRouter();
  const { registerGuard } = useNavigationGuard();
  const form = useForm<InvoiceReportInput>({
    mode: "all",
    // Live rows are normalized; the schema also accepts legacy snapshots without consumption fields.
    resolver: zodResolver(invoiceReportFormSchema) as Resolver<InvoiceReportInput>,
    defaultValues: initialRequestedReport?.snapshot ?? { reportMonth: initialMonth, invoices: [], additionalItems: [] },
  });
  const { control, getValues, reset, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "invoices" });
  const { fields: additionalFields, append: appendAdditionalItem, remove: removeAdditionalItem } = useFieldArray({ control, name: "additionalItems" });
  const reportMonth = useWatch({ control, name: "reportMonth" });
  const invoices = useWatch({ control, name: "invoices" }) ?? [];
  const additionalItems = useWatch({ control, name: "additionalItems" }) ?? [];
  const [reportCreated, setReportCreated] = useState(Boolean(initialRequestedReport));
  const [reportVersion, setReportVersion] = useState<number | null>(initialRequestedReport?.version ?? null);
  const [storedReports, setStoredReports] = useState(initialStoredReports);
  const [utilityHistoryUpdates, setUtilityHistoryUpdates] = useState<{
    base: UtilityHistoryMonth[];
    byMonth: Map<string, UtilityHistoryMonth | null>;
  }>({ base: initialUtilityHistory, byMonth: new Map() });
  const utilityHistory = utilityHistoryUpdates.base === initialUtilityHistory
    ? [...initialUtilityHistory.filter((item) => !utilityHistoryUpdates.byMonth.has(item.reportMonth)), ...[...utilityHistoryUpdates.byMonth.values()].filter((item): item is UtilityHistoryMonth => item !== null)]
    : initialUtilityHistory;
  const [reportSaving, setReportSaving] = useState(false);
  const [reportLoadingMonth, setReportLoadingMonth] = useState<string | null>(null);
  const [reportDeletingMonth, setReportDeletingMonth] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(initialRequestedReportError);
  const [phase, setPhase] = useState<ImportPhase>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>(initialRequestedReport?.snapshot.invoices.some((invoice) => invoice.sources.some((source) => source.kind === "upload"))
    ? ["A korábban feltöltött PDF-ek előnézete az újranyitott kimutatásban nem érhető el."]
    : []);
  const [previewSource, setPreviewSource] = useState<InvoiceSource | null>(null);
  const [exportSnapshot, setExportSnapshot] = useState<import("../types").SummaryExportSnapshot | null>(null);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<Record<string, string>>({});
  const [gmailConnected, setGmailConnected] = useState(initialGmailConnected);
  const [expensePresets, setExpensePresets] = useState(initialExpensePresets);
  const [presetSelection, setPresetSelection] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [focusedCategory, setFocusedCategory] = useState<InvoiceReportInput["invoices"][number]["category"] | "all">("all");
  const [presetsError, setPresetsError] = useState(initialPresetsError);
  const [presetsRefreshing, setPresetsRefreshing] = useState(false);
  const uploadUrlsRef = useRef(new Set<string>());
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const runId = useRef(0);
  const deletedKeys = useRef(new Set<string>());
  const reportStartPending = useRef(false);
  const reportOperationPending = useRef(false);
  const requestedMonthHandled = useRef<string | null>(requestedMonth);

  useEffect(() => () => {
    runId.current += 1;
    uploadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadUrlsRef.current.clear();
  }, []);

  const summary = summarizeInvoices(invoices, 0, additionalItems);
  const displayTotalLabel = "Összesen";
  const canCreateReport = !initialStoredReportsError && !storedReports.some((report) => report.reportMonth === initialMonth);
  const categorySummary = ["water", "gas", "electricity", "waste", "other"] as const;
  const categoryTotals = categorySummary.map((category) => {
    let total = 0;
    let hasValue = false;
    let overflow = false;
    let excludedCount = 0;
    for (const month of utilityHistory) {
      for (const entry of month.series) {
        if (entry.category !== category || entry.unit !== null) continue;
        excludedCount += entry.excludedCostCount;
        if (entry.costMinor === null) continue;
        const next = total + entry.costMinor;
        if (!Number.isSafeInteger(next)) { overflow = true; continue; }
        total = next;
        hasValue = true;
      }
    }
    return { category, total, hasValue, overflow, excludedCount };
  });

  const openExport = () => {
    const current = getValues();
    const currentSummary = summarizeInvoices(current.invoices, 0, current.additionalItems);
    setExportSnapshot(createSummaryExportSnapshot(
      current.reportMonth,
      current.invoices,
      current.additionalItems,
      currentSummary.formattedTotal,
      `${Math.round(currentSummary.knownHalfShares.firstMinor / 100).toLocaleString("hu-HU")} Ft`,
      currentSummary.totalOverflow,
    ));
  };

  const showSource = (source: InvoiceSource) => setPreviewSource(source);

  const mergeIncoming = (incoming: InvoiceRowInput[], expectedRunId: number, expectedMonth: string) => {
    if (runId.current !== expectedRunId || getValues("reportMonth") !== expectedMonth) return false;
    const current = getValues("invoices");
    const merged = mergeImportedInvoices(current, incoming, deletedKeys.current);
    const mergedIds = new Set(merged.map((row) => row.id));
    for (let index = current.length - 1; index >= 0; index -= 1) {
      if (!mergedIds.has(current[index].id)) remove(index);
    }
    const liveRows = getValues("invoices");
    const newRows: InvoiceRowInput[] = [];
    for (const row of merged) {
      const existingIndex = liveRows.findIndex((item) => item.id === row.id);
      if (existingIndex < 0) {
        newRows.push(row);
        continue;
      }
      for (const key of Object.keys(row) as Array<keyof InvoiceRowInput>) {
        const currentValue = liveRows[existingIndex][key];
        const nextValue = row[key];
        if (currentValue !== nextValue) setValue(`invoices.${existingIndex}.${key}` as never, nextValue as never, { shouldDirty: true, shouldValidate: true });
      }
    }
    if (newRows.length > 0) append(newRows, { shouldFocus: false });
    return true;
  };

  const clearReportEditor = () => {
    runId.current += 1;
    deletedKeys.current.clear();
    uploadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadUrlsRef.current.clear();
    setUploadPreviewUrls({});
    setPreviewSource(null);
    setWarnings([]);
    setStatus(null);
    setPhase(null);
    reset({ reportMonth: initialMonth, invoices: [], additionalItems: [] });
    setItemPickerOpen(false);
    setReportCreated(false);
    setReportVersion(null);
    setReportError(null);
    setFocusedCategory("all");
    requestedMonthHandled.current = null;
  };

  const returnToList = () => {
    if (reportOperationPending.current || phase || reportStartPending.current) return;
    if (form.formState.isDirty && reportCreated && !window.confirm("A nem mentett változtatások elvesznek. Visszatérsz a kimutatásokhoz?")) return;
    clearReportEditor();
    router.replace("/app/monthly-expenses", { scroll: false });
  };

  const refreshExpensePresets = async () => {
    setPresetsRefreshing(true);
    setPresetsError(null);
    try {
      const result = await loadExpensePresets();
      if (!result.success) {
        setPresetsError(result.error.message);
        return;
      }
      setExpensePresets(result.data);
      setPresetSelection((current) => result.data.some((preset) => preset.id === current) ? current : "");
    } catch {
      setPresetsError("A mentett tételek most nem tölthetők be.");
    } finally {
      setPresetsRefreshing(false);
    }
  };

  const addAdditionalItem = () => {
    if (!reportCreated || additionalFields.length >= 100) return;
    if (presetsRefreshing && presetSelection) return;
    const selectedPreset = presetSelection ? expensePresets.find((preset) => preset.id === presetSelection) : null;
    if (presetSelection && !selectedPreset) {
      setPresetsError("Ez a mentett tétel már nem érhető el. Nyisd meg újra a választót.");
      return;
    }
    appendAdditionalItem(createAdditionalItemFromPreset(selectedPreset ?? null, crypto.randomUUID()), { shouldFocus: !selectedPreset });
    setPresetSelection("");
    setItemPickerOpen(false);
  };

  const startNewReport = async (addInvoiceAfterStart = false) => {
    if (!canCreateReport || reportCreated || presetsRefreshing || reportStartPending.current || reportOperationPending.current) return;
    reportStartPending.current = true;
    const targetMonth = getValues("reportMonth");
    const expectedRunId = runId.current;
    setPresetsRefreshing(true);
    setPresetsError(null);
    try {
      const result = await loadExpensePresets();
      if (!result.success) {
        setPresetsError(result.error.message);
        return;
      }
      if (reportCreated || runId.current !== expectedRunId || getValues("reportMonth") !== targetMonth) return;
      setExpensePresets(result.data);
      setPresetSelection("");
      appendAdditionalItem(createDefaultAdditionalItems(result.data, () => crypto.randomUUID()), { shouldFocus: false });
      setReportCreated(true);
      setReportVersion(null);
      if (addInvoiceAfterStart) {
        append(createEmptyInvoice(targetMonth));
        toast.success("Elindítottam a hónapot, és hozzáadtam egy üres számlasort.");
      }
    } catch {
      setPresetsError("A mentett alapértelmezett tételek most nem tölthetők be. Próbáld újra.");
    } finally {
      reportStartPending.current = false;
      setPresetsRefreshing(false);
    }
  };

  const saveReport = () => {
    if (!reportCreated || reportOperationPending.current || phase) return;
    const parsed = invoiceReportFormSchema.safeParse(getValues());
    if (!parsed.success) {
      setReportError(parsed.error.issues[0]?.message ?? "Ellenőrizd a kimutatás adatait mentés előtt.");
      toast.error("A kimutatás hibás adatot tartalmaz, ezért nem mentettem el.");
      return;
    }
    reportOperationPending.current = true;
    setReportSaving(true);
    setReportError(null);
    startTransition(async () => {
      try {
        const result = await saveMonthlyExpenseReport(parsed.data, reportVersion);
        if (!result.success) {
          setReportError(result.error.message);
          toast.error(result.error.message);
          return;
        }
        setReportVersion(result.data.version);
        reset(parsed.data);
        setUtilityHistoryUpdates((current) => {
          const byMonth = current.base === initialUtilityHistory ? new Map(current.byMonth) : new Map<string, UtilityHistoryMonth | null>();
          byMonth.set(result.data.reportMonth, buildUtilityHistoryMonth(parsed.data.invoices, result.data.reportMonth));
          return { base: initialUtilityHistory, byMonth };
        });
        setStoredReports((current) => {
          const next = current.filter((report) => report.reportMonth !== result.data.reportMonth);
          const summary = summarizeInvoices(parsed.data.invoices, 0, parsed.data.additionalItems);
          return [{ reportMonth: result.data.reportMonth, version: result.data.version, updatedAt: result.data.updatedAt, rowCount: parsed.data.invoices.length + parsed.data.additionalItems.length, totalMinor: summary.totalMinor, totalOverflow: summary.totalOverflow }, ...next].sort((a, b) => b.reportMonth.localeCompare(a.reportMonth));
        });
        requestedMonthHandled.current = result.data.reportMonth;
        router.replace(`/app/monthly-expenses?month=${result.data.reportMonth}`, { scroll: false });
        toast.success("A havi kimutatás elmentve.");
      } catch {
        setReportError("A kimutatás most nem menthető. Próbáld újra.");
        toast.error("A kimutatás most nem menthető. Próbáld újra.");
      } finally {
        reportOperationPending.current = false;
        setReportSaving(false);
      }
    });
  };

  const openStoredReport = (targetMonth: string, addInvoiceAfterLoad = false, routeDriven = false) => {
    if (reportOperationPending.current || reportStartPending.current || presetsRefreshing || phase) return;
    if (reportCreated && form.formState.isDirty && !window.confirm("A nem mentett változtatások elvesznek. Megnyitod a mentett kimutatást?")) {
      if (routeDriven) {
        requestedMonthHandled.current = reportVersion ? reportMonth : null;
        router.replace(reportVersion ? `/app/monthly-expenses?month=${reportMonth}` : "/app/monthly-expenses", { scroll: false });
      }
      return;
    }
    reportOperationPending.current = true;
    setReportLoadingMonth(targetMonth);
    setReportError(null);
    startTransition(async () => {
      try {
        const result = await loadMonthlyExpenseReport(targetMonth);
        if (!result.success) {
          setReportError(result.error.message);
          toast.error(result.error.message);
          return;
        }
        runId.current += 1;
        deletedKeys.current.clear();
        uploadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        uploadUrlsRef.current.clear();
        setUploadPreviewUrls({});
        setPreviewSource(null);
        setWarnings(result.data.snapshot.invoices.some((invoice) => invoice.sources.some((source) => source.kind === "upload"))
          ? ["A korábban feltöltött PDF-ek előnézete az újranyitott kimutatásban nem érhető el."]
          : []);
        setStatus(null);
        setPhase(null);
        setItemPickerOpen(false);
        setPresetSelection("");
        reset(result.data.snapshot);
        setReportCreated(true);
        setReportVersion(result.data.version);
        requestedMonthHandled.current = targetMonth;
        router.replace(`/app/monthly-expenses?month=${targetMonth}`, { scroll: false });
        if (addInvoiceAfterLoad) {
          append(createEmptyInvoice(targetMonth));
          toast.success("Megnyitottam a kimutatást, és hozzáadtam egy üres számlasort.");
        }
      } catch {
        setReportError("A kimutatás most nem tölthető be. Próbáld újra.");
        toast.error("A kimutatás most nem tölthető be. Próbáld újra.");
      } finally {
        reportOperationPending.current = false;
        setReportLoadingMonth(null);
      }
    });
  };

  const deleteStoredReport = (report: MonthlyExpenseReportItem) => {
    if (reportOperationPending.current || reportStartPending.current || presetsRefreshing || phase) return;
    if (!window.confirm(`Törlöd a(z) ${formatMonth(report.reportMonth)} havi kimutatást és minden hozzá tartozó számlaadatot, valamint hozzáadott tételt? A törlés nem vonható vissza.`)) return;
    reportOperationPending.current = true;
    setReportDeletingMonth(report.reportMonth);
    setReportError(null);
    startTransition(async () => {
      try {
        const result = await deleteMonthlyExpenseReport({ reportMonth: report.reportMonth, expectedVersion: report.version });
        if (!result.success) {
          setReportError(result.error.message);
          toast.error(result.error.message);
          return;
        }
        setStoredReports((current) => current.filter((item) => item.reportMonth !== result.data.reportMonth));
        setUtilityHistoryUpdates((current) => {
          const byMonth = current.base === initialUtilityHistory ? new Map(current.byMonth) : new Map<string, UtilityHistoryMonth | null>();
          byMonth.set(result.data.reportMonth, null);
          return { base: initialUtilityHistory, byMonth };
        });
        toast.success("A kimutatás törölve.");
      } catch {
        setReportError("A kimutatás most nem törölhető. Próbáld újra.");
        toast.error("A kimutatás most nem törölhető. Próbáld újra.");
      } finally {
        reportOperationPending.current = false;
        setReportDeletingMonth(null);
      }
    });
  };

  const addManualInvoice = () => {
    setFocusedCategory("all");
    append(createEmptyInvoice(reportMonth));
    toast.success("Hozzáadtam egy üres számlasort.");
  };

  const removeInvoice = (index: number) => {
    const invoice = getValues(`invoices.${index}`);
    if (invoice) getInvoiceMergeKeys(invoice).forEach((key) => deletedKeys.current.add(key));
    remove(index);
  };

  const connectMailbox = async () => {
    setPhase("connecting");
    try {
      await connectGmail();
      toast.success("A Gmail-összekapcsolás elindult.");
    } catch (error) {
      unstable_rethrow(error);
      toast.error(error instanceof Error ? error.message : "A Gmail-összekapcsolás nem indítható.");
    } finally {
      setPhase(null);
    }
  };

  const importFromGmail = async () => {
    if (!reportCreated || phase) return;
    const targetMonth = reportMonth;
    const currentRunId = ++runId.current;
    setPhase("searching");
    setStatus(`E-mailek keresése · ${formatMonth(targetMonth)}`);
    setWarnings([]);
    const nextWarnings: string[] = [];
    const imported: InvoiceRowInput[] = [];

    try {
      const collection = await collectGmailInvoices(targetMonth);
      if (runId.current !== currentRunId || getValues("reportMonth") !== targetMonth) return;
      if (!collection?.success) {
        if (collection?.error.type === "gmail-reconnect-required") setGmailConnected(false);
        throw new Error(readError(collection));
      }
      setGmailConnected(true);
      const data = collection.data;
      nextWarnings.push(...data.warnings);
      if (!data.complete) nextWarnings.push("A Gmail-keresés részleges eredményt adott. Az itt látható számlák nem feltétlenül teljesek.");
      const candidates = data.candidates;
      if (candidates.length === 0) {
        setStatus(data.complete ? "Nem találtam feldolgozható számladokumentumot ebben a hónapban." : "A részleges keresés nem talált feldolgozható dokumentumot.");
      } else {
        setPhase("processing-gmail");
        let processed = 0;
        setStatus(`${candidates.length} számladokumentum feldolgozása`);
        await runWithConcurrency(candidates, 2, async (candidate: GmailCandidate) => {
          const reference: GmailDocumentReference = {
            reportMonth: targetMonth,
            messageId: candidate.messageId,
            fileName: candidate.fileName,
            ...(candidate.attachmentId ? { attachmentId: candidate.attachmentId } : {}),
            ...(candidate.linkIndex !== undefined ? { linkIndex: candidate.linkIndex } : {}),
          };
          try {
            const result = await importGmailInvoice(reference);
            if (runId.current !== currentRunId || getValues("reportMonth") !== targetMonth) return;
            if (!result?.success) {
              if (result?.error.type === "gmail-reconnect-required") setGmailConnected(false);
              throw new Error(readError(result));
            }
            imported.push(...result.data.invoices);
            nextWarnings.push(...result.data.warnings.map((warning) => `${candidate.fileName}: ${warning}`));
          } catch (error) {
            if (runId.current === currentRunId) nextWarnings.push(`${candidate.fileName}: ${error instanceof Error ? error.message : "A dokumentum feldolgozása nem sikerült."}`);
          } finally {
            processed += 1;
            if (runId.current === currentRunId) setStatus(`${processed} / ${candidates.length} dokumentum feldolgozva`);
          }
        }, () => runId.current === currentRunId && getValues("reportMonth") === targetMonth);
        if (runId.current !== currentRunId || getValues("reportMonth") !== targetMonth) return;
        if (!mergeIncoming(imported, currentRunId, targetMonth)) return;
        setStatus(`${candidates.length} dokumentum feldolgozva · ${imported.length} számlasor érkezett`);
      }
    } catch (error) {
      if (runId.current === currentRunId && getValues("reportMonth") === targetMonth) {
        nextWarnings.push(error instanceof Error ? error.message : "A Gmail-levelek most nem olvashatók.");
        setStatus("A Gmail-import nem fejeződött be.");
      }
    } finally {
      if (runId.current === currentRunId && getValues("reportMonth") === targetMonth) {
        setWarnings(nextWarnings);
        setPhase(null);
        if (nextWarnings.length > 0) toast.error("A Gmail-import részben sikerült. Nézd át az üzeneteket.");
        else toast.success(imported.length > 0 ? `Beolvastam ${imported.length} számlajelöltet.` : "A Gmail-keresés befejeződött.");
      }
    }
  };

  const importPdfFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!reportCreated || files.length === 0) return;
    const targetMonth = reportMonth;
    const currentRunId = ++runId.current;
    setPhase("uploading");
    setStatus(`${files.length} PDF feldolgozása`);
    setWarnings([]);
    const nextWarnings: string[] = [];
    const imported: InvoiceRowInput[] = [];
    const previewByDocumentId: Record<string, string> = {};
    let processed = 0;

    await runWithConcurrency(files, 2, async (file) => {
      let previewUrl: string | null = null;
      try {
        if (runId.current !== currentRunId || getValues("reportMonth") !== targetMonth) return;
        if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Csak PDF-fájlt válassz ki.");
        if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: a PDF nagyobb a megengedett 3 MiB-nál.`);
        previewUrl = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
        uploadUrlsRef.current.add(previewUrl);
        const payload = new FormData();
        payload.set("file", file);
        payload.set("reportMonth", targetMonth);
        const response = await fetch("/api/monthly-expenses/import", { method: "POST", body: payload });
        if (runId.current !== currentRunId || getValues("reportMonth") !== targetMonth) {
          URL.revokeObjectURL(previewUrl);
          uploadUrlsRef.current.delete(previewUrl);
          return;
        }
        const result = await response.json().catch(() => null) as { success?: boolean; data?: { invoices: InvoiceRowInput[]; warnings: string[] }; error?: { message?: string } } | null;
        if (!response.ok || !result?.success || !result.data) throw new Error(result?.error?.message ?? `${file.name}: a PDF feldolgozása nem sikerült.`);
        imported.push(...result.data.invoices);
        nextWarnings.push(...result.data.warnings.map((warning) => `${file.name}: ${warning}`));
        if (previewUrl && result.data.invoices.some((invoice) => invoice.sources.some((source) => source.kind === "upload"))) {
          for (const invoice of result.data.invoices) {
            for (const source of invoice.sources) if (source.kind === "upload") previewByDocumentId[source.documentId] = previewUrl;
          }
        } else if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          uploadUrlsRef.current.delete(previewUrl);
        }
      } catch (error) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          uploadUrlsRef.current.delete(previewUrl);
        }
        nextWarnings.push(error instanceof Error ? error.message : `${file.name}: nem sikerült feldolgozni.`);
      } finally {
        processed += 1;
        if (runId.current === currentRunId) setStatus(`${processed} / ${files.length} PDF feldolgozva`);
      }
    }, () => runId.current === currentRunId && getValues("reportMonth") === targetMonth);

    if (runId.current === currentRunId && getValues("reportMonth") === targetMonth) {
      const merged = mergeIncoming(imported, currentRunId, targetMonth);
      if (merged) {
        setUploadPreviewUrls((current) => ({ ...current, ...previewByDocumentId }));
        setStatus(`${processed} PDF feldolgozva · ${imported.length} számlasor érkezett`);
      }
      setWarnings(nextWarnings);
      setPhase(null);
      if (nextWarnings.length > 0) toast.error("Néhány PDF-et nem sikerült feldolgozni. A sikeres számlák megmaradtak.");
      else toast.success(`Beolvastam ${imported.length} számlajelöltet.`);
    }
  };

  const handleRequestedMonth = useEffectEvent((requestedMonthValue: string | null) => {
    if (!requestedMonthValue) {
      requestedMonthHandled.current = null;
      return;
    }
    if (requestedMonthHandled.current === requestedMonthValue) return;
    requestedMonthHandled.current = requestedMonthValue;
    const restoreCurrentRoute = () => {
      requestedMonthHandled.current = reportVersion ? reportMonth : null;
      router.replace(reportVersion ? `/app/monthly-expenses?month=${reportMonth}` : "/app/monthly-expenses", { scroll: false });
    };
    if (requestedMonthValue === "invalid") {
      if (reportCreated && form.formState.isDirty && !window.confirm("A nem mentett változtatások elvesznek. Megnyitod ezt a hónaphivatkozást?")) {
        restoreCurrentRoute();
        return;
      }
      if (reportCreated) clearReportEditor();
      requestedMonthHandled.current = requestedMonth;
      setReportError("A hónap hivatkozása hibás. Válassz egy mentett hónapot a listából.");
      return;
    }
    if (!storedReports.some((report) => report.reportMonth === requestedMonthValue)) {
      if (reportCreated && form.formState.isDirty && !window.confirm("A nem mentett változtatások elvesznek. Megnyitod ezt a hónaphivatkozást?")) {
        restoreCurrentRoute();
        return;
      }
      if (reportCreated) clearReportEditor();
      requestedMonthHandled.current = requestedMonth;
      setReportError("Ehhez a hónaphoz nincs mentett kimutatás. A link nem hoz létre új hónapot.");
      return;
    }
    openStoredReport(requestedMonthValue, false, true);
  });

  useEffect(() => {
    startTransition(() => handleRequestedMonth(requestedMonth));
  }, [requestedMonth]);

  useEffect(() => registerGuard(() => {
    if (reportSaving || phase) return false;
    if (!reportCreated || !form.formState.isDirty) return true;
    return window.confirm("A kimutatás nem mentett módosításokat tartalmaz. Elhagyod az oldalt?");
  }), [registerGuard, reportCreated, form.formState.isDirty, reportSaving, phase]);

  const openInvoiceIntent = () => {
    if (storedReports.some((report) => report.reportMonth === initialMonth)) openStoredReport(initialMonth, true);
    else if (canCreateReport) void startNewReport(true);
    else setReportError("Az aktuális havi kimutatás állapota nem ellenőrizhető. Frissítsd az oldalt, majd próbáld újra.");
  };

  return (
    <FormProvider {...form}>
      {!reportCreated && overviewHeader}
      <form noValidate onSubmit={(event) => event.preventDefault()} className={`grid grid-cols-1 gap-5 ${reportCreated ? "xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]" : "lg:grid-cols-2"}`}>
        <fieldset disabled={reportSaving || reportLoadingMonth !== null || reportDeletingMonth !== null} className="contents">
          {!reportCreated && <div className="col-span-full">
            <AppCreationBar
              title="Havi kimutatások"
              description={initialStoredReportsError ? "A mentett hónapok most nem tölthetők be. Próbáld újra később." : canCreateReport ? `${formatMonth(initialMonth)} · Kezdd el a hónap számláinak és közös kiadásainak összesítését.` : `${formatMonth(initialMonth)} · A hónap kimutatása már létezik, itt folytathatod.`}
              actionLabel={canCreateReport ? "Új kimutatás" : "Kimutatás megnyitása"}
              onAction={() => { if (canCreateReport) void startNewReport(); else if (!initialStoredReportsError) void openStoredReport(initialMonth); }}
              icon={canCreateReport ? Plus : FilePenLine}
              pending={presetsRefreshing || reportLoadingMonth !== null}
              disabled={Boolean(initialStoredReportsError) || reportSaving || reportDeletingMonth !== null}
            />
          </div>}
          {reportError && <p role="alert" className="col-span-full rounded-xl border border-primary/25 bg-note-peach/60 px-4 py-3 text-sm text-foreground">{reportError}</p>}
          {initialStoredReportsError && <p role="alert" className="col-span-full rounded-xl border border-primary/25 bg-note-peach/60 px-4 py-3 text-sm text-foreground">{initialStoredReportsError}</p>}
          {!reportCreated && initialIntent === "invoice" && <section className="col-span-full flex flex-col justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold text-foreground">Számlát szeretnél rögzíteni?</h2><p className="mt-1 text-sm text-muted-foreground">A megfelelő havi kimutatás csak a gomb megnyomásakor nyílik meg vagy indul el.</p></div><button type="button" onClick={openInvoiceIntent} disabled={reportLoadingMonth !== null || presetsRefreshing || reportSaving} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"><Plus aria-hidden="true" className="size-4" />Számla felvétele</button></section>}
          {!reportCreated && <div className="col-span-full"><UtilityHistoryChart history={utilityHistory} error={initialUtilityHistoryError} endMonth={initialMonth} /></div>}
          {!reportCreated && (
            <div className="col-span-full grid gap-5 lg:grid-cols-2">
              <section aria-labelledby="utility-category-overview" className="rounded-[22px] border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3"><h2 id="utility-category-overview" className="text-lg font-semibold tracking-tight">Közművek áttekintése</h2><span className="text-xs text-muted-foreground">legfeljebb 12 mentett hónap</span></div>
                <ul className="mt-4 space-y-2">
                  {categoryTotals.map((item) => {
                    const logo = UTILITY_CATEGORY_LOGOS[item.category];
                    return <li key={item.category} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2">
                      <span className="flex min-w-0 items-center gap-3 font-medium">
                        {logo && <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"><Image src={logo.src} alt={logo.name} width={56} height={40} className="h-full w-full object-contain" /></span>}
                        <span>{{ water: "Víz", gas: "Gáz", electricity: "Villany", waste: "Hulladék", other: "Egyéb" }[item.category]}</span>
                      </span>
                      <span className="text-right"><span className="block font-semibold tabular-nums">{item.overflow ? "Túl nagy összeg" : item.hasValue ? `${formatReportTotal(item.total)} Ft` : "Nincs adat"}</span><span className="text-xs text-muted-foreground">{item.hasValue ? item.excludedCount ? `részleges ismert költség · ${item.excludedCount} kihagyott` : "ismert költség" : item.excludedCount ? `${item.excludedCount} kihagyott tétel` : "nincs rögzítve"}</span></span>
                    </li>;
                  })}
                </ul>
              </section>
              <section aria-label="Mentett havi kimutatások" className="rounded-[22px] border border-border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Mentett kimutatások</h2><p className="mt-1 text-sm text-muted-foreground">A korábbi hónapok megnyitása és kezelése.</p></div>
                </div>
                {presetsError && <p role="status" className="mt-3 text-sm text-muted-foreground">{presetsError}</p>}
                {storedReports.length === 0 && !initialStoredReportsError ? <p className="mt-5 rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Még nincs mentett kimutatás.</p> : <ul className="mt-4 space-y-2">{storedReports.map((report, index) => <li key={report.reportMonth} className={`flex items-center gap-2 rounded-xl border pr-2 ${index === 0 ? "border-primary/20 bg-primary/5" : "border-border bg-background"}`}>
                  <button type="button" onClick={() => openStoredReport(report.reportMonth)} disabled={reportLoadingMonth !== null || reportSaving || presetsRefreshing} className="flex min-h-16 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted/70 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><span><span className="block font-medium">{formatMonth(report.reportMonth)}</span><span className="block text-sm text-muted-foreground">{report.rowCount} sor · {report.totalOverflow ? "Összesítés túl nagy" : `${formatReportTotal(report.totalMinor)} Ft`}</span></span><span className="text-sm text-muted-foreground">{reportLoadingMonth === report.reportMonth ? "Betöltés…" : "Megnyitás"}</span></button>
                  <button type="button" onClick={() => deleteStoredReport(report)} disabled={presetsRefreshing} aria-label={`${formatMonth(report.reportMonth)} kimutatásának törlése`} title="Kimutatás törlése" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring">{reportDeletingMonth === report.reportMonth ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}</button>
                </li>)}</ul>}
              </section>
            </div>
          )}
          {reportCreated && <>
            <div className="col-span-full">
              <nav aria-label="Morzsanavigáció" className="mb-3 flex items-center gap-2 text-sm text-muted-foreground"><button type="button" onClick={returnToList} disabled={Boolean(phase)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-muted hover:text-foreground disabled:opacity-60"><ArrowLeft aria-hidden="true" className="size-4" />Közművek</button><span aria-hidden="true">/</span><span className="font-medium text-foreground">{formatMonth(reportMonth)}</span></nav>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold tracking-tight text-foreground">{formatMonth(reportMonth)}</h1><p className="mt-1 text-sm text-muted-foreground">A hónapban rögzített számlák és kiadások.</p></div>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label="Előző mentett hónap" onClick={() => { const index = storedReports.findIndex((item) => item.reportMonth === reportMonth); if (index >= 0 && index < storedReports.length - 1) openStoredReport(storedReports[index + 1].reportMonth); }} disabled={Boolean(phase) || storedReports.findIndex((item) => item.reportMonth === reportMonth) >= storedReports.length - 1} className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card disabled:opacity-40"><ChevronLeft aria-hidden="true" className="size-4" /></button>
                  <label className="sr-only" htmlFor="report-month-selector">Mentett hónap kiválasztása</label><select id="report-month-selector" value={reportMonth} onChange={(event) => openStoredReport(event.target.value)} className="min-h-10 max-w-[min(58vw,18rem)] rounded-xl border border-border bg-card px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring"><option value={reportMonth}>{formatMonth(reportMonth)}</option>{storedReports.filter((item) => item.reportMonth !== reportMonth).map((item) => <option key={item.reportMonth} value={item.reportMonth}>{formatMonth(item.reportMonth)}</option>)}</select>
                  <button type="button" aria-label="Következő mentett hónap" onClick={() => { const index = storedReports.findIndex((item) => item.reportMonth === reportMonth); if (index > 0) openStoredReport(storedReports[index - 1].reportMonth); }} disabled={Boolean(phase) || storedReports.findIndex((item) => item.reportMonth === reportMonth) <= 0} className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-card disabled:opacity-40"><ChevronRight aria-hidden="true" className="size-4" /></button>
                </div>
              </div>
            </div>
        <section aria-label="Havi számlák" className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-6">
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button type="button" onClick={() => void (gmailConnected ? importFromGmail() : connectMailbox())} disabled={Boolean(phase)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-900 shadow-sm hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {phase === "searching" || phase === "processing-gmail" || phase === "connecting" ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" /> : <Mail aria-hidden="true" className="size-4 shrink-0" />}
                  {gmailConnected ? "E-mailekből" : "Gmail összekapcsolása"}
                </button>
                <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-medium text-sky-900 hover:bg-sky-100 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${phase ? "pointer-events-none opacity-60" : ""}`}>
                  {phase === "uploading" ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary" /> : <FileUp aria-hidden="true" className="size-4 shrink-0 text-primary" />}
                  PDF feltöltése
                  <input type="file" accept="application/pdf,.pdf" multiple disabled={Boolean(phase)} onChange={(event) => void importPdfFiles(event)} className="sr-only" />
                </label>
                <button type="button" onClick={addManualInvoice} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <Plus aria-hidden="true" className="size-4 shrink-0" /> Számla hozzáadása
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">PDF-enként legfeljebb 3 MiB tölthető fel. A Gmail csak számlajelölteket olvas, levelet nem küld.</p>

              {status && <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-sm text-foreground">{status}</p>}
              {warnings.length > 0 && (
                <div role="alert" className="mt-3 rounded-xl border border-primary/25 bg-note-peach/60 p-4">
                  <p className="font-medium text-foreground">Az import részleges vagy ellenőrzést igényel</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
                </div>
              )}

              {fields.length > 0 && (
                <div className="mt-7 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Beérkezett számlák <span className="text-sm font-normal text-muted-foreground">({fields.length})</span></h3><label className="flex items-center gap-2 text-sm text-muted-foreground">Kategóriafókusz<select value={focusedCategory} onChange={(event) => setFocusedCategory(event.target.value as typeof focusedCategory)} className="min-h-11 rounded-lg border border-border bg-card px-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring"><option value="all">Teljes hónap</option>{Object.entries(INVOICE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
                  {fields.map((field, index) => invoices[index]?.category === focusedCategory || focusedCategory === "all" ? <InvoiceRowCard key={field.id} index={index} onRemove={() => removeInvoice(index)} onPreview={showSource} /> : null)}
                  {focusedCategory !== "all" && !invoices.some((invoice) => invoice.category === focusedCategory) && <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Ebben a kategóriában nincs számlasor.</p>}
                </div>
              )}
            </>
        </section>

        <aside id="report-summary" className="h-fit rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-6 xl:sticky xl:top-5" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-2xl font-semibold tracking-tight leading-tight text-foreground">Hónap összesítése</h2>
          <p className="mt-1 text-xs text-muted-foreground">A teljes hónapot mutatja, a kategóriafókusztól függetlenül.</p>

          {summary.totalOverflow && <p role="alert" className="mt-3 rounded-xl bg-note-peach p-3 text-sm">Az összegek meghaladják a biztonságos számolási korlátot. Az összesítésből kimaradtak tételek; ellenőrizd a megadott összegeket.</p>}
            <>
              {invoices.length > 0 && (
                <ul aria-label="A kimutatás számlái" className="mt-5 space-y-2 border-b border-border pb-4 text-sm">
                  {invoices.map((invoice) => (
                    <li key={invoice.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words">
                        {INVOICE_CATEGORY_LABELS[invoice.category]}
                        <span className="text-muted-foreground"> · {invoice.providerName.trim() || "Ismeretlen szolgáltató"}</span>
                      </span>
                      <span className="shrink-0 text-right tabular-nums">
                        {invoice.amountMinor !== null && invoice.currency === "HUF" ? `${formatMinorAsHuf(invoice.amountMinor)} Ft` : "Összeg hiányos"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5">
                {additionalFields.length > 0 && (
                  <ul aria-label="Számla nélküli tételek" className="space-y-2 text-sm">
                    {additionalFields.map((field, index) => <AdditionalExpenseRow key={field.id} id={field.id} index={index} initialAmountMinor={field.amountMinor} nameReadOnly={field.isDefault || Boolean(field.presetId)} onRemove={() => removeAdditionalItem(index)} />)}
                  </ul>
                )}
                {additionalFields.length < 100 && (
                  itemPickerOpen ? (
                    <div id="summary-item-picker" className="mt-3 rounded-xl border border-border bg-background p-3">
                      <label>
                        <span className="sr-only">Mentett vagy egyedi tétel kiválasztása</span>
                        <select autoFocus value={presetSelection} onChange={(event) => setPresetSelection(event.target.value)} disabled={presetsRefreshing} className="min-h-10 w-full min-w-0 rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60">
                          <option value="">Egyedi tétel</option>
                          {expensePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name} · {formatMinorAsHuf(preset.amountMinor)} Ft</option>)}
                        </select>
                      </label>
                      {presetsError && <p role="status" className="mt-2 text-xs text-muted-foreground">{presetsError}</p>}
                      <div className="mt-2 flex items-center gap-2">
                        <button type="button" onClick={addAdditionalItem} disabled={presetsRefreshing && Boolean(presetSelection)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring">Hozzáadás</button>
                        <button type="button" onClick={() => setItemPickerOpen(false)} className="min-h-10 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Mégse</button>
                        {presetsRefreshing && <LoaderCircle aria-label="Tételek betöltése" className="size-4 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setItemPickerOpen(true); setPresetSelection(""); void refreshExpensePresets(); }} disabled={presetsRefreshing} aria-expanded={false} aria-controls="summary-item-picker" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      <Plus aria-hidden="true" className="size-4 text-accent" /> Tétel hozzáadása
                    </button>
                  )
                )}
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-4 px-4 text-lg font-semibold"><span>{displayTotalLabel}</span><span className="tabular-nums">{summary.formattedTotal}</span></div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-note-sage p-4 text-sm">
                  <span className="font-medium text-foreground">Fele</span>
                  <span className="font-semibold tabular-nums">{Math.round(summary.knownHalfShares.firstMinor / 100).toLocaleString("hu-HU")} Ft</span>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={saveReport} disabled={reportSaving || reportLoadingMonth !== null || Boolean(phase)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-note-yellow/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60">
                  {reportSaving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}Mentés
                </button>
                <button ref={exportButtonRef} type="button" onClick={openExport} disabled={Boolean(phase)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-action-warm px-4 text-sm font-medium text-action-warm-foreground hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60">Exportálás…</button>
              </div>
            </>
        </aside>
          </>}

        {exportSnapshot && <ExpenseSummaryExportDialog snapshot={exportSnapshot} open={Boolean(exportSnapshot)} onOpenChange={(open) => {
          if (!open) {
            setExportSnapshot(null);
            requestAnimationFrame(() => exportButtonRef.current?.focus());
          }
        }} />}
        {previewSource && <SourcePreviewDialog key={previewSource.kind === "upload" ? previewSource.documentId : `${previewSource.messageId}-${previewSource.attachmentId ?? previewSource.linkIndex}`} source={previewSource} uploadPreviewUrls={uploadPreviewUrls} onClose={() => setPreviewSource(null)} />}
        </fieldset>
      </form>
      {reportCreated && <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t bg-card px-4 py-2 shadow-sm lg:hidden"><a href="#report-summary" className="flex min-h-11 min-w-0 flex-col justify-center text-xs text-muted-foreground"><span>Összegzés megnyitása</span><strong className="truncate text-base text-foreground tabular-nums">{summary.formattedTotal}</strong></a><button type="button" onClick={saveReport} disabled={reportSaving || reportLoadingMonth !== null || Boolean(phase)} className="min-h-11 rounded-xl bg-action-warm px-6 text-sm font-medium text-action-warm-foreground disabled:opacity-60">Mentés</button></div>}
    </FormProvider>
  );
};

export default MonthlyExpensesForm;
