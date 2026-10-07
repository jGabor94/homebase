"use client";

import { useState, type FC } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Trash2 } from "lucide-react";
import type { InvoiceReportInput } from "../types";
import { formatMinorAsHuf, parseHungarianAmountToMinor } from "../utils/money";

interface AdditionalExpenseRowProps {
  index: number;
  id: string;
  initialAmountMinor: number | null;
  nameReadOnly: boolean;
  onRemove: () => void;
}

const AdditionalExpenseRow: FC<AdditionalExpenseRowProps> = ({ index, id, initialAmountMinor, nameReadOnly, onRemove }) => {
  const { control } = useFormContext<InvoiceReportInput>();
  const [amountText, setAmountText] = useState(() => formatMinorAsHuf(initialAmountMinor));
  const [amountEntryError, setAmountEntryError] = useState<string | null>(null);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_112px_40px] items-start gap-2">
      <Controller
        control={control}
        name={`additionalItems.${index}.name`}
        render={({ field, fieldState }) => (
          nameReadOnly
            ? <div className="col-span-1 min-w-0 text-xs text-muted-foreground">
                <span className="sr-only">Mentett tétel neve: </span>
                <span className="block min-h-10 content-center break-words py-2 text-sm font-medium text-foreground">{field.value}</span>
                {fieldState.error && <span id={`additional-name-error-${id}`} role="alert" className="mt-1 block text-[11px] text-primary">{fieldState.error.message}</span>}
              </div>
            : <label className="min-w-0 text-xs text-muted-foreground">
                <span className="sr-only">Számla nélküli tétel neve</span>
                <input {...field} name={field.name} ref={field.ref} value={field.value ?? ""} maxLength={120} placeholder="Tétel neve" aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? `additional-name-error-${id}` : undefined} className="min-h-10 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-0 text-sm font-medium text-foreground placeholder:text-muted-foreground hover:border-border focus:border-border focus:px-2 focus-visible:outline-2 focus-visible:outline-ring" />
                {fieldState.error && <span id={`additional-name-error-${id}`} role="alert" className="mt-1 block text-[11px] text-primary">{fieldState.error.message}</span>}
              </label>
        )}
      />
      <Controller
        control={control}
        name={`additionalItems.${index}.amountMinor`}
        render={({ field, fieldState }) => (
          <label className="text-xs text-muted-foreground">
            <span className="sr-only">Összeg forintban</span>
            <span className="relative block">
              <input
                type="text"
                inputMode="decimal"
                name={field.name}
                ref={field.ref}
                value={amountText}
                onChange={(event) => {
                  const nextText = event.target.value;
                  setAmountText(nextText);
                  const parsed = parseHungarianAmountToMinor(nextText);
                  const valid = parsed !== null && parsed >= 0 && parsed <= 9_000_000_000_000;
                  setAmountEntryError(valid ? null : !nextText.trim() ? "Add meg az összeget." : parsed === null ? "Adj meg érvényes összeget." : parsed < 0 ? "Az összeg nem lehet negatív." : "Az összeg túl nagy.");
                  field.onChange(valid ? parsed : null);
                }}
                onBlur={() => {
                  field.onBlur();
                  if (field.value !== null && field.value !== undefined) {
                    setAmountText(formatMinorAsHuf(field.value));
                    setAmountEntryError(null);
                  }
                }}
                aria-label="Összeg forintban"
                aria-invalid={Boolean(amountEntryError) || fieldState.invalid}
                aria-describedby={amountEntryError || fieldState.error ? `additional-amount-error-${id}` : undefined}
                placeholder="0"
                className="min-h-10 w-full rounded-lg border border-border bg-background px-3 pr-7 text-right text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">Ft</span>
            </span>
            {(amountEntryError || fieldState.error) && <span id={`additional-amount-error-${id}`} role="alert" className="mt-1 block text-[11px] text-primary">{amountEntryError ?? fieldState.error?.message}</span>}
          </label>
        )}
      />
      <button type="button" onClick={onRemove} aria-label="Számla nélküli tétel törlése" className="mb-0.5 inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-note-peach/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
};

export default AdditionalExpenseRow;
