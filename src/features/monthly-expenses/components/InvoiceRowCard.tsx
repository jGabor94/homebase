"use client";

import { useEffect, useRef, useState, type FC } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Check, ChevronDown, Droplets, FileText, Flame, MoreHorizontal, Trash2, Zap } from "lucide-react";
import toast from "react-hot-toast";
import Image from "next/image";
import { CONSUMPTION_UNITS, INVOICE_CATEGORIES, INVOICE_CATEGORY_LABELS, INVOICE_ISSUE_LABELS, UTILITY_PROVIDER_LOGOS } from "../config";
import type { InvoiceField, InvoiceReportInput, InvoiceRowInput } from "../types";
import { formatMinorAsHuf, parseHungarianAmountToMinor } from "../utils/money";
import { parseConsumptionQuantityInput } from "../utils/consumption";

interface InvoiceRowCardProps {
  index: number;
  onRemove: () => void;
  onPreview: (source: InvoiceRowInput["sources"][number]) => void;
}

const fieldsToIssue: Partial<Record<InvoiceField, InvoiceRowInput["issues"][number]>> = {
  providerName: "missing-provider",
  category: "missing-category",
  invoiceNumber: "missing-invoice-number",
  amountMinor: "missing-amount",
  dueDate: "missing-due-date",
  billingPeriod: "missing-period",
  issuedAt: "missing-issued-at",
};

const evidenceFieldLabels: Record<string, string> = {
  providerName: "Szolgáltató",
  category: "Szolgáltatás típusa",
  documentType: "Számla típusa",
  invoiceNumber: "Számlaszám",
  amountMinor: "Fizetendő összeg",
  currency: "Pénznem",
  dueDate: "Fizetési határidő",
  billingPeriod: "Számlázási időszak",
  issuedAt: "Számla kelte",
  consumptionQuantity: "Fogyasztási mennyiség",
  consumptionUnit: "Fogyasztási egység",
};

const categoryTone: Record<InvoiceRowInput["category"], string> = {
  water: "border-sky-200 bg-sky-50/70",
  gas: "border-rose-200 bg-rose-50/70",
  electricity: "border-amber-200 bg-amber-50/70",
  waste: "border-emerald-200 bg-emerald-50/70",
  other: "border-slate-200 bg-slate-50/80",
};

const categoryIcon = {
  water: Droplets,
  gas: Flame,
  electricity: Zap,
  waste: Trash2,
  other: MoreHorizontal,
} as const;

const documentTypeLabel: Record<NonNullable<InvoiceRowInput["documentType"]>, string> = {
  invoice: "Normál számla",
  credit: "Jóváírás",
  correction: "Helyesbítő",
  cancellation: "Sztornó",
};

const formatConflictValue = (field: string, value: string | null) => {
  if (value === null) return "üres";
  if (field === "amountMinor") {
    const amount = Number(value);
    if (Number.isSafeInteger(amount)) return `${formatMinorAsHuf(amount)} Ft`;
  }
  return value;
};

const InvoiceRowCard: FC<InvoiceRowCardProps> = ({ index, onRemove, onPreview }) => {
  const { control, register, setValue, getValues, trigger, formState: { errors } } = useFormContext<InvoiceReportInput>();
  const invoice = useWatch({ control, name: `invoices.${index}` });
  const amount = useWatch({ control, name: `invoices.${index}.amountMinor` });
  const [amountText, setAmountText] = useState(formatMinorAsHuf(amount));
  const [amountInvalid, setAmountInvalid] = useState(false);
  const lastSyncedAmount = useRef(amount);
  const consumptionQuantity = useWatch({ control, name: `invoices.${index}.consumptionQuantity` });
  const [consumptionText, setConsumptionText] = useState(consumptionQuantity === null ? "" : String(consumptionQuantity).replace(".", ","));
  const [consumptionInvalid, setConsumptionInvalid] = useState(false);
  const lastSyncedConsumption = useRef(consumptionQuantity);

  useEffect(() => {
    if (amount !== lastSyncedAmount.current) {
      lastSyncedAmount.current = amount;
      setAmountText(formatMinorAsHuf(amount));
    }
  }, [amount]);

  useEffect(() => {
    if (!Object.is(consumptionQuantity, lastSyncedConsumption.current)) {
      lastSyncedConsumption.current = consumptionQuantity;
      setConsumptionText(consumptionQuantity === null ? "" : String(consumptionQuantity).replace(".", ","));
      setConsumptionInvalid(false);
    }
  }, [consumptionQuantity]);

  if (!invoice) return null;

  const markEdited = (field: InvoiceField) => {
    const path = `invoices.${index}` as const;
    const current = getValues(path);
    const issue = fieldsToIssue[field];
    const fieldValue = current[field];
    const hasValue = field === "providerName" || field === "billingPeriod" || field === "invoiceNumber"
      ? typeof fieldValue === "string" && fieldValue.trim().length > 0
      : field === "amountMinor" ? typeof fieldValue === "number"
        : field === "dueDate" || field === "issuedAt" ? typeof fieldValue === "string" && fieldValue.length > 0
          : true;
    setValue(`${path}.manuallyEditedFields`, [...new Set([...current.manuallyEditedFields, field])], { shouldDirty: true });
    setValue(`${path}.fieldOrigin.${field}`, "manual", { shouldDirty: true });
    setValue(`${path}.reviewStatus`, "needs-review", { shouldDirty: true });
    if (issue) {
      const issues = new Set(current.issues);
      if (hasValue) issues.delete(issue);
      else issues.add(issue);
      setValue(`${path}.issues`, [...issues], { shouldDirty: true });
    }
    if (field === "currency") {
      const issues = new Set(getValues(`${path}.issues`));
      if (fieldValue === null || String(fieldValue).toUpperCase() === "HUF") issues.delete("foreign-currency");
      else issues.add("foreign-currency");
      setValue(`${path}.issues`, [...issues], { shouldDirty: true });
    }
  };

  const markReviewed = async () => {
    if (!await trigger(`invoices.${index}`)) {
      toast.error("Javítsd a jelölt mezőket, mielőtt ellenőrzöttnek jelölöd a számlát.");
      return;
    }
    const current = getValues(`invoices.${index}`);
    if (current.documentType === "invoice" && current.amountMinor !== null && current.amountMinor < 0) {
      setValue(`invoices.${index}.issues`, [...new Set([...current.issues, "correction-unresolved" as const])], { shouldDirty: true });
      toast.error("A negatív összegű normál számla ellenőrzést igényel; válaszd ki a dokumentum valódi jellegét.");
      return;
    }
    const required: Array<[InvoiceRowInput["issues"][number], boolean]> = [
      ["missing-provider", !current.providerName.trim()],
      ["missing-category", !current.category],
      ["missing-amount", current.amountMinor === null],
      ["missing-invoice-number", !current.invoiceNumber?.trim()],
      ["missing-due-date", !current.dueDate],
      ["missing-period", !current.billingPeriod.trim()],
      ["missing-issued-at", !current.issuedAt],
    ];
    const issues = new Set(current.issues);
    for (const [issue, isMissing] of required) {
      if (isMissing) issues.add(issue);
      else issues.delete(issue);
    }
    setValue(`invoices.${index}.issues`, [...issues], { shouldDirty: true, shouldValidate: true });
    if (required.some(([, isMissing]) => isMissing) || current.currency !== "HUF") {
      toast.error("A szolgáltatót, számlaszámot, összeget, határidőt, időszakot, számla keltét és forint pénznemet még ellenőrizd.");
      return;
    }
    if (current.documentType === null) {
      toast.error("Válaszd ki, hogy normál számla, jóváírás, helyesbítés vagy sztornó-e.");
      return;
    }
    if (current.documentType === "invoice" && current.amountMinor !== null && current.amountMinor < 0) {
      toast.error("Egy normál számla negatív összege nem számítható bele. Ellenőrizd a dokumentum típusát és előjelét.");
      return;
    }
    if (current.conflicts.length > 0) {
      toast.error("Előbb oldd fel vagy fogadd el a források közötti eltérést.");
      return;
    }
    setValue(`invoices.${index}.reviewStatus`, "reviewed", { shouldDirty: true });
    toast.success("A számlát átnézettnek jelöltem.");
  };

  const fieldError = errors.invoices?.[index];

  const fieldClass = "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const labelClass = "block text-sm font-medium text-foreground";
  const sourceLabels = [...new Set(invoice.sources.map((source) => source.fileName))];
  const CategoryIcon = categoryIcon[invoice.category];
  const providerName = invoice.providerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const providerLogo = Object.entries(UTILITY_PROVIDER_LOGOS).find(([name]) => providerName.includes(name))?.[1];
  const amountSummary = invoice.amountMinor === null
    ? "Összeg nincs megadva"
    : invoice.currency === "HUF"
      ? `${formatMinorAsHuf(invoice.amountMinor)} Ft`
      : invoice.currency
        ? `${formatMinorAsHuf(invoice.amountMinor)} ${invoice.currency}`
        : `${formatMinorAsHuf(invoice.amountMinor)} · pénznem hiányzik`;

  return (
    <article className={`overflow-hidden rounded-[20px] border shadow-sm ${categoryTone[invoice.category]}`}>
      <header className="flex flex-wrap items-start gap-3 border-b border-black/5 bg-white/65 p-4 sm:items-center sm:p-5">
        <span className="inline-flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-foreground shadow-sm">
          {providerLogo ? <Image src={providerLogo.src} alt="" width={64} height={48} className="h-full w-full object-contain" /> : <CategoryIcon aria-hidden="true" className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{INVOICE_CATEGORY_LABELS[invoice.category]} <span aria-hidden="true">·</span> {invoice.documentType ? documentTypeLabel[invoice.documentType] : "Számlatípus nincs megadva"}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight text-foreground">{invoice.providerName.trim() || "Új számlasor"}</h3>
            <span className="text-base font-semibold tabular-nums text-foreground">{amountSummary}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-white/75 px-2.5 py-1">{invoice.invoiceNumber?.trim() || "Számlaszám hiányzik"}</span>
            <span className="rounded-full bg-white/75 px-2.5 py-1">{invoice.dueDate ? `Határidő: ${invoice.dueDate}` : "Határidő nincs megadva"}</span>
            <span className={`rounded-full px-2.5 py-1 font-medium ${invoice.reviewStatus === "reviewed" && invoice.issues.length === 0 ? "bg-emerald-100 text-emerald-800" : invoice.issues.length ? "bg-amber-100 text-amber-900" : "bg-white/85 text-slate-700"}`}>
              {invoice.reviewStatus === "reviewed" && invoice.issues.length === 0 ? "Ellenőrizve" : invoice.issues.length ? `Ellenőrzésre vár · ${invoice.issues.length} jelzés` : invoice.sources.length ? "Beolvasva · ellenőrizendő" : "Szerkesztés alatt"}
            </span>
          </div>
          <p className="mt-2 break-all text-xs text-muted-foreground">{sourceLabels.length ? `Forrás: ${sourceLabels.join(", ")}` : "Kézzel felvitt számla"}</p>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:max-w-full">
          {invoice.sources.map((source, sourceIndex) => (
            <button key={`${source.kind}-${source.kind === "upload" ? source.documentId : source.messageId}-${sourceIndex}`} type="button" onClick={() => onPreview(source)} className="inline-flex min-h-11 min-w-0 max-w-48 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-primary" /><span className="truncate">{source.fileName}</span>
            </button>
          ))}
          <button type="button" onClick={onRemove} aria-label="Számlasor törlése" className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-note-peach hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <Trash2 aria-hidden="true" className="size-5" />
          </button>
        </div>
      </header>

      <div className="bg-white/45 p-4 sm:p-5">
      {invoice.issues.length > 0 && (
        <ul className="mt-3 space-y-2 rounded-xl bg-note-yellow/70 p-3 text-sm text-foreground" aria-label="Ellenőrzési jelzések">
          {invoice.issues.map((issue) => <li key={issue}>
            <span>• {INVOICE_ISSUE_LABELS[issue]}</span>
            {(issue === "source-unverified" || issue === "unreadable") && <button type="button" onClick={() => { setValue(`invoices.${index}.issues`, getValues(`invoices.${index}.issues`).filter((item) => item !== issue), { shouldDirty: true }); setValue(`invoices.${index}.reviewStatus`, "needs-review", { shouldDirty: true }); toast.success("A forrást személyesen ellenőrzöttnek vettem."); }} className="ml-2 min-h-9 rounded-md border border-border bg-card px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring">Ezt a számlán ellenőriztem</button>}
            {issue === "possible-duplicate" && <button type="button" onClick={() => { setValue(`invoices.${index}.issues`, getValues(`invoices.${index}.issues`).filter((item) => item !== issue), { shouldDirty: true }); setValue(`invoices.${index}.reviewStatus`, "needs-review", { shouldDirty: true }); toast.success("Mindkét számlát külön tételként hagytam meg."); }} className="ml-2 min-h-9 rounded-md border border-border bg-card px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring">Mindkettőt külön számlaként tartom meg</button>}
          </li>)}
        </ul>
      )}
      {invoice.documentType === "invoice" && invoice.amountMinor !== null && invoice.amountMinor < 0 && <p role="alert" className="mt-3 rounded-xl bg-note-peach/70 p-3 text-sm text-foreground">A normál számla negatív összege nincs beleszámítva. Ellenőrizd, hogy jóváírás vagy más módosító dokumentum-e.</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>
          Szolgáltató
          <input {...register(`invoices.${index}.providerName`, { onChange: () => markEdited("providerName") })} maxLength={160} autoComplete="organization" aria-invalid={Boolean(fieldError?.providerName)} className={fieldClass} />
          {fieldError?.providerName?.message && <span role="alert" className="mt-1 block text-xs text-primary">{fieldError.providerName.message}</span>}
        </label>
        <label className={labelClass}>
          Szolgáltatás típusa
          <select {...register(`invoices.${index}.category`, { onChange: () => markEdited("category") })} className={fieldClass}>
            {INVOICE_CATEGORIES.map((category) => <option key={category} value={category}>{INVOICE_CATEGORY_LABELS[category]}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Fizetendő összeg (Ft)
          <input
            inputMode="decimal"
            value={amountText}
            onChange={(event) => {
              setAmountText(event.target.value);
              const parsed = parseHungarianAmountToMinor(event.target.value);
              if (parsed !== null) {
                setAmountInvalid(false);
                lastSyncedAmount.current = parsed;
                setValue(`invoices.${index}.amountMinor`, parsed, { shouldDirty: true, shouldValidate: true });
                markEdited("amountMinor");
              } else if (event.target.value !== "") {
                setAmountInvalid(true);
                lastSyncedAmount.current = null;
                setValue(`invoices.${index}.amountMinor`, null, { shouldDirty: true, shouldValidate: true });
                markEdited("amountMinor");
              }
              if (event.target.value === "") {
                setAmountInvalid(false);
                lastSyncedAmount.current = null;
                setValue(`invoices.${index}.amountMinor`, null, { shouldDirty: true, shouldValidate: true });
                markEdited("amountMinor");
              }
            }}
            onBlur={() => {
              const parsed = parseHungarianAmountToMinor(amountText);
              if (parsed !== null) setAmountText(formatMinorAsHuf(parsed));
            }}
            aria-describedby={`amount-help-${invoice.id}`}
            aria-invalid={amountInvalid || Boolean(fieldError?.amountMinor)}
            className={fieldClass}
          />
          <span id={`amount-help-${invoice.id}`} className="mt-1 block text-xs font-normal text-muted-foreground">Például: 12 450 vagy 12 450,50</span>
          {(amountInvalid || fieldError?.amountMinor?.message) && <span role="alert" className="mt-1 block text-xs font-medium text-primary">Adj meg érvényes forintösszeget.</span>}
        </label>
        <label className={labelClass}>
          Pénznem
          <Controller control={control} name={`invoices.${index}.currency`} render={({ field }) => (
            <input {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value.trim().toUpperCase() || null); markEdited("currency"); }} maxLength={3} aria-invalid={!invoice.currency || invoice.currency !== "HUF"} className={fieldClass} />
          )} />
          {invoice.currency !== "HUF" && <span className="mt-1 block text-xs text-muted-foreground">{invoice.currency ? "Csak a HUF összeg számítható bele." : "Add meg a számlán szereplő pénznemet."}</span>}
        </label>
        <label className={labelClass}>
          Számlaszám
          <Controller control={control} name={`invoices.${index}.invoiceNumber`} render={({ field }) => (
            <input {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value || null); markEdited("invoiceNumber"); }} maxLength={120} aria-invalid={Boolean(fieldError?.invoiceNumber)} className={fieldClass} />
          )} />
          {fieldError?.invoiceNumber?.message && <span role="alert" className="mt-1 block text-xs text-primary">{fieldError.invoiceNumber.message}</span>}
        </label>
        <label className={labelClass}>
          Fizetési határidő
          <Controller control={control} name={`invoices.${index}.dueDate`} render={({ field }) => (
            <input type="date" {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value || null); markEdited("dueDate"); }} aria-invalid={Boolean(fieldError?.dueDate)} className={fieldClass} />
          )} />
          {fieldError?.dueDate?.message && <span role="alert" className="mt-1 block text-xs text-primary">{fieldError.dueDate.message}</span>}
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Számlázási időszak
          <input {...register(`invoices.${index}.billingPeriod`, { onChange: () => markEdited("billingPeriod") })} maxLength={160} placeholder="Például: 2026. augusztus" aria-invalid={Boolean(fieldError?.billingPeriod)} className={fieldClass} />
          {fieldError?.billingPeriod?.message && <span role="alert" className="mt-1 block text-xs text-primary">{fieldError.billingPeriod.message}</span>}
        </label>
        <label className={labelClass}>
          Fogyasztás
          <input
            inputMode="decimal"
            value={consumptionText}
            onChange={(event) => {
              const value = event.target.value;
              setConsumptionText(value);
              const parsed = parseConsumptionQuantityInput(value);
              if (value.trim() === "") {
                setConsumptionInvalid(false);
                lastSyncedConsumption.current = null;
                setValue(`invoices.${index}.consumptionQuantity`, null, { shouldDirty: true, shouldValidate: true });
              } else if (parsed !== null) {
                setConsumptionInvalid(false);
                lastSyncedConsumption.current = parsed;
                setValue(`invoices.${index}.consumptionQuantity`, parsed, { shouldDirty: true, shouldValidate: true });
              } else {
                setConsumptionInvalid(true);
                // Keep invalid input invalid in the form so saving cannot silently turn it into missing data.
                lastSyncedConsumption.current = Number.NaN;
                setValue(`invoices.${index}.consumptionQuantity`, Number.NaN, { shouldDirty: true, shouldValidate: true });
              }
              markEdited("consumptionQuantity");
            }}
            aria-invalid={consumptionInvalid || Boolean(fieldError?.consumptionQuantity)}
            aria-describedby={`consumption-help-${invoice.id}`}
            className={fieldClass}
          />
          <span id={`consumption-help-${invoice.id}`} className="mt-1 block text-xs font-normal text-muted-foreground">Például: 123,45</span>
          {(consumptionInvalid || fieldError?.consumptionQuantity?.message) && <span role="alert" className="mt-1 block text-xs text-primary">Adj meg nullánál nem kisebb, legfeljebb 1 000 000 000 000 értéket.</span>}
        </label>
        <label className={labelClass}>
          Fogyasztási egység
          <Controller control={control} name={`invoices.${index}.consumptionUnit`} render={({ field }) => (
            <select {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value || null); markEdited("consumptionUnit"); }} className={fieldClass}>
              <option value="">Nincs megadva</option>
              {CONSUMPTION_UNITS.map((unit) => <option key={unit} value={unit}>{unit === "m3" ? "m³" : unit === "piece" ? "db" : unit}</option>)}
            </select>
          )} />
        </label>
        <label className={labelClass}>
          Számla kelte
          <Controller control={control} name={`invoices.${index}.issuedAt`} render={({ field }) => (
            <input type="date" {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value || null); markEdited("issuedAt"); }} className={fieldClass} />
          )} />
        </label>
        <label className={labelClass}>
          Számla típusa
          <Controller control={control} name={`invoices.${index}.documentType`} render={({ field }) => (
            <select {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value || null); setValue(`invoices.${index}.reviewStatus`, "needs-review", { shouldDirty: true }); }} className={fieldClass}>
              <option value="">Válassz típust</option>
              <option value="invoice">Normál számla</option>
              <option value="credit">Jóváírás</option>
              <option value="correction">Helyesbítő</option>
              <option value="cancellation">Sztornó</option>
            </select>
          )} />
        </label>
        {invoice.documentType !== null && invoice.documentType !== "invoice" && (
          <label className={labelClass}>
            Kapcsolódó számlaszám
            <Controller control={control} name={`invoices.${index}.relatedInvoiceNumber`} render={({ field }) => (
              <input {...field} value={field.value ?? ""} onChange={(event) => { field.onChange(event.target.value || null); setValue(`invoices.${index}.reviewStatus`, "needs-review", { shouldDirty: true }); }} maxLength={120} className={fieldClass} />
            )} />
          </label>
        )}
      </div>

      {(Object.keys(invoice.fieldEvidence).length > 0 || invoice.conflicts.length > 0) && (
        <details className="group mt-4 rounded-xl border border-border bg-background px-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180" /> Bizonyítékok és eltérések
          </summary>
          {invoice.conflicts.length > 0 && <div className="mb-3 rounded-lg bg-note-peach/70 p-3 text-sm"><p className="font-medium">Eltérő adatot találtunk:</p><ul className="mt-2 space-y-2">{invoice.conflicts.map((conflict, conflictIndex) => <li key={`${conflict.field}-${conflictIndex}`}><strong>{evidenceFieldLabels[conflict.field] ?? conflict.field}:</strong> „{formatConflictValue(conflict.field, conflict.keptValue)}” · új forrás: „{formatConflictValue(conflict.field, conflict.incomingValue)}” ({conflict.sourceLabel})</li>)}</ul><button type="button" onClick={() => { setValue(`invoices.${index}.conflicts`, [], { shouldDirty: true }); setValue(`invoices.${index}.issues`, getValues(`invoices.${index}.issues`).filter((issue) => issue !== "conflict"), { shouldDirty: true }); setValue(`invoices.${index}.reviewStatus`, "needs-review", { shouldDirty: true }); toast.success("Az aktuális szerkesztett értékeket fogadtam el."); }} className="mt-3 min-h-10 rounded-lg border border-border bg-card px-3 font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-ring">Elfogadom a mostani értékeket</button></div>}
          <ul className="mb-3 space-y-2 text-sm text-muted-foreground">
            {Object.entries(invoice.fieldEvidence).map(([field, evidence]) => evidence && <li key={field}><strong className="text-foreground">{evidenceFieldLabels[field] ?? field} · {evidence.page}. oldal:</strong> „{evidence.quote}”</li>)}
          </ul>
        </details>
      )}

      {invoice.reviewStatus !== "reviewed" && (
        <button type="button" onClick={markReviewed} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent/15 px-4 text-sm font-medium text-foreground hover:bg-accent/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <Check aria-hidden="true" className="size-4" /> Átnéztem ezt a számlát
        </button>
      )}
      </div>
    </article>
  );
};

export default InvoiceRowCard;
