"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileUp, LoaderCircle, Mail, Plus, RefreshCw, Trash2 } from "lucide-react";
import { startTransition, useEffect, useRef, useState, type ChangeEvent, type FC } from "react";
import { FormProvider, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import toast, { Toaster } from "react-hot-toast";
import { INVOICE_CATEGORY_LABELS, MAX_UPLOAD_BYTES } from "../config";
import { connectGmail } from "../dal/connection";
import { collectGmailInvoices, importGmailInvoice } from "../dal/mutations";
import { deleteMonthlyExpenseReport, loadMonthlyExpenseReport, saveMonthlyExpenseReport } from "../dal/mutations";
import { loadExpensePresets } from "../dal/presets";
import type { ExpensePresetDto, GmailCandidate, GmailDocumentReference, InvoiceReportInput, InvoiceRowInput, InvoiceSource, MonthlyExpenseReportItem } from "../types";
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
  initialMonth: string;
  initialGmailConnected: boolean;
  initialExpensePresets: ExpensePresetDto[];
  initialPresetsError: string | null;
  initialStoredReports: MonthlyExpenseReportItem[];
  initialStoredReportsError: string | null;
  initialUtilityHistory: UtilityHistoryMonth[];
  initialUtilityHistoryError: string | null;
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

const MonthlyExpensesForm: FC<MonthlyExpensesFormProps> = ({ initialMonth, initialGmailConnected, initialExpensePresets, initialPresetsError, initialStoredReports, initialStoredReportsError, initialUtilityHistory, initialUtilityHistoryError }) => {
  const form = useForm<InvoiceReportInput>({
    mode: "all",
    // Live rows are normalized; the schema also accepts legacy snapshots without consumption fields.
    resolver: zodResolver(invoiceReportFormSchema) as Resolver<InvoiceReportInput>,
    defaultValues: { reportMonth: initialMonth, invoices: [], additionalItems: [] },
  });
  const { control, getValues, reset, setValue } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "invoices" });
  const { fields: additionalFields, append: appendAdditionalItem, remove: removeAdditionalItem } = useFieldArray({ control, name: "additionalItems" });
  const reportMonth = useWatch({ control, name: "reportMonth" });
  const invoices = useWatch({ control, name: "invoices" }) ?? [];
  const additionalItems = useWatch({ control, name: "additionalItems" }) ?? [];
  const [reportCreated, setReportCreated] = useState(false);
  const [reportVersion, setReportVersion] = useState<number | null>(null);
  const [storedReports, setStoredReports] = useState(initialStoredReports);
  const [utilityHistory, setUtilityHistory] = useState(initialUtilityHistory);
  const [reportSaving, setReportSaving] = useState(false);
  const [reportLoadingMonth, setReportLoadingMonth] = useState<string | null>(null);
  const [reportDeletingMonth, setReportDeletingMonth] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [phase, setPhase] = useState<ImportPhase>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [previewSource, setPreviewSource] = useState<InvoiceSource | null>(null);
  const [exportSnapshot, setExportSnapshot] = useState<import("../types").SummaryExportSnapshot | null>(null);
  const [uploadPreviewUrls, setUploadPreviewUrls] = useState<Record<string, string>>({});
  const [gmailConnected, setGmailConnected] = useState(initialGmailConnected);
  const [expensePresets, setExpensePresets] = useState(initialExpensePresets);
  const [presetSelection, setPresetSelection] = useState("");
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [presetsError, setPresetsError] = useState(initialPresetsError);
  const [presetsRefreshing, setPresetsRefreshing] = useState(false);
  const uploadUrlsRef = useRef(new Set<string>());
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const runId = useRef(0);
  const deletedKeys = useRef(new Set<string>());
  const reportStartPending = useRef(false);
  const reportOperationPending = useRef(false);

  useEffect(() => () => {
    runId.current += 1;
    uploadUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadUrlsRef.current.clear();
  }, []);

  const summary = summarizeInvoices(invoices, 0, additionalItems);
  const displayTotalLabel = "Összesen";
  const canCreateReport = !initialStoredReportsError && !storedReports.some((report) => report.reportMonth === initialMonth);

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

  const returnToList = () => {
    if (reportOperationPending.current || phase || reportStartPending.current) return;
    if (form.formState.isDirty && reportCreated) {
      const confirmed = window.confirm("A nem mentett változtatások elvesznek. Visszatérsz a kimutatásokhoz?");
      if (!confirmed) {
        return;
      }
    }

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

  const startNewReport = async () => {
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
        setUtilityHistory((current) => [...current.filter((item) => item.reportMonth !== result.data.reportMonth), buildUtilityHistoryMonth(parsed.data.invoices, result.data.reportMonth)]);
        setStoredReports((current) => {
          const next = current.filter((report) => report.reportMonth !== result.data.reportMonth);
          const summary = summarizeInvoices(parsed.data.invoices, 0, parsed.data.additionalItems);
          return [{ reportMonth: result.data.reportMonth, version: result.data.version, updatedAt: result.data.updatedAt, rowCount: parsed.data.invoices.length + parsed.data.additionalItems.length, totalMinor: summary.totalMinor, totalOverflow: summary.totalOverflow }, ...next].sort((a, b) => b.reportMonth.localeCompare(a.reportMonth));
        });
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

  const openStoredReport = (targetMonth: string) => {
    if (reportOperationPending.current || reportStartPending.current || presetsRefreshing || phase) return;
    if (reportCreated && form.formState.isDirty && !window.confirm("A nem mentett változtatások elvesznek. Megnyitod a mentett kimutatást?")) return;
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
        setUtilityHistory((current) => current.filter((item) => item.reportMonth !== result.data.reportMonth));
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

  return (
    <FormProvider {...form}>
      <Toaster position="bottom-center" toastOptions={{ duration: 4500, style: { background: "#fffcf7", color: "#42271e", border: "1px solid #e9dfd1" } }} />
      <form noValidate onSubmit={(event) => event.preventDefault()} className={`grid gap-5 ${reportCreated ? "lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]" : ""}`}>
        <fieldset disabled={reportSaving || reportLoadingMonth !== null || reportDeletingMonth !== null} className="contents">
          {reportError && <p role="alert" className="col-span-full rounded-xl border border-primary/25 bg-note-peach/60 px-4 py-3 text-sm text-foreground">{reportError}</p>}
          {initialStoredReportsError && <p role="alert" className="col-span-full rounded-xl border border-primary/25 bg-note-peach/60 px-4 py-3 text-sm text-foreground">{initialStoredReportsError}</p>}
          {!reportCreated && <UtilityHistoryChart history={utilityHistory} error={initialUtilityHistoryError} />}
          {!reportCreated && (
            <section aria-label="Mentett havi kimutatások" className="col-span-full rounded-[20px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(91,61,36,0.06)] sm:p-6">
              {canCreateReport && (
                <button type="button" onClick={() => void startNewReport()} disabled={presetsRefreshing || reportLoadingMonth !== null || reportSaving} className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {presetsRefreshing ? <RefreshCw aria-hidden="true" className="size-4 animate-spin" /> : <Plus aria-hidden="true" className="size-4" />}
                  Új kimutatás · {formatMonth(initialMonth)}
                </button>
              )}
              {presetsError && <p role="status" className="mb-4 text-sm text-muted-foreground">{presetsError}</p>}
              <h2 className="font-serif text-xl font-semibold text-foreground">Mentett kimutatások</h2>
              {storedReports.length === 0 && !initialStoredReportsError && <p className="mt-3 text-sm text-muted-foreground">Még nincs mentett kimutatás.</p>}
              <ul className="mt-3 space-y-2">
                {storedReports.map((report, index) => <li key={report.reportMonth} className={`flex items-center gap-2 rounded-xl border pr-2 ${index === 0 ? "border-accent/25 bg-note-sage/30" : "border-border bg-background"}`}>
                  <button type="button" onClick={() => openStoredReport(report.reportMonth)} disabled={reportLoadingMonth !== null || reportSaving || presetsRefreshing} className="flex min-h-16 min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-note-yellow/30 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    <span>
                      <span className="block font-medium text-foreground">{formatMonth(report.reportMonth)}</span>
                      <span className="block text-sm text-muted-foreground">{report.rowCount} sor · {report.totalOverflow ? "Összesítés túl nagy" : `${formatReportTotal(report.totalMinor)} Ft`}</span>
                    </span>
                  <span className="text-sm font-medium text-muted-foreground">
                    {reportLoadingMonth === report.reportMonth ? "Betöltés…" : "Megnyitás"}
                  </span>
                  </button>
                  <button type="button" onClick={() => deleteStoredReport(report)} disabled={presetsRefreshing} aria-label={`${formatMonth(report.reportMonth)} kimutatásának törlése`} title="Kimutatás törlése" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                    {reportDeletingMonth === report.reportMonth ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
                  </button>
                </li>)}
              </ul>
            </section>
          )}
          {reportCreated && <>
            <div className="col-span-full flex flex-wrap items-center gap-4">
              <button type="button" onClick={returnToList} disabled={Boolean(phase)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" /> Kimutatások</button>
              <h2 className="font-serif text-2xl font-semibold text-foreground">{formatMonth(reportMonth)}</h2>
            </div>
        <section aria-label="Havi számlák" className="rounded-[20px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(91,61,36,0.06)] sm:p-7">
            <>
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button type="button" onClick={() => void (gmailConnected ? importFromGmail() : connectMailbox())} disabled={Boolean(phase)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:brightness-95 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {phase === "searching" || phase === "processing-gmail" || phase === "connecting" ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" /> : <Mail aria-hidden="true" className="size-4 shrink-0" />}
                  {gmailConnected ? "E-mailekből" : "Gmail összekapcsolása"}
                </button>
                <label className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-note-yellow/50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${phase ? "pointer-events-none opacity-60" : ""}`}>
                  {phase === "uploading" ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin text-primary" /> : <FileUp aria-hidden="true" className="size-4 shrink-0 text-primary" />}
                  PDF feltöltése
                  <input type="file" accept="application/pdf,.pdf" multiple disabled={Boolean(phase)} onChange={(event) => void importPdfFiles(event)} className="sr-only" />
                </label>
                <button type="button" onClick={addManualInvoice} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-note-yellow/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  <Plus aria-hidden="true" className="size-4 shrink-0 text-accent" /> Számla hozzáadása
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
                  {fields.map((field, index) => <InvoiceRowCard key={field.id} index={index} onRemove={() => removeInvoice(index)} onPreview={showSource} />)}
                </div>
              )}
            </>
        </section>

        <aside className="h-fit rounded-[20px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(91,61,36,0.06)] sm:p-6 lg:sticky lg:top-5" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="font-serif text-[26px] font-semibold leading-tight text-foreground">Összegzés</h2>

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
                <button ref={exportButtonRef} type="button" onClick={openExport} disabled={Boolean(phase)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60">Exportálás…</button>
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
    </FormProvider>
  );
};

export default MonthlyExpensesForm;
