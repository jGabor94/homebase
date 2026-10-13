"use client";

import { useState, type FC } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createExpensePreset, deleteExpensePreset, loadExpensePresets, updateExpensePreset } from "../dal/presets";
import type { ExpensePresetDto, ExpensePresetFormInput } from "../types";
import { formatMinorAsHuf, parseHungarianAmountToMinor } from "../utils/money";
import { expensePresetFormSchema } from "../zod/schema";

interface PresetSettingsFormProps {
  initialPresets: ExpensePresetDto[];
  initialError: string | null;
}

const sortPresets = (presets: ExpensePresetDto[]) => [...presets].sort((left, right) =>
  left.name.localeCompare(right.name, "hu") || left.id.localeCompare(right.id));

const PresetSettingsForm: FC<PresetSettingsFormProps> = ({ initialPresets, initialError }) => {
  const [presets, setPresets] = useState(() => sortPresets(initialPresets));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [amountEntryError, setAmountEntryError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const busy = saving || refreshing || deletingId !== null;
  const form = useForm<ExpensePresetFormInput>({
    mode: "all",
    resolver: zodResolver(expensePresetFormSchema),
    defaultValues: { name: "", amountMinor: null, isDefault: false },
  });

  const resetEditor = () => {
    form.reset({ name: "", amountMinor: null, isDefault: false });
    setAmountText("");
    setAmountEntryError(null);
    setEditingId(null);
  };

  const refreshPresets = async () => {
    if (busy) return;
    setRefreshing(true);
    setErrorMessage(null);
    try {
      const result = await loadExpensePresets();
      if (!result.success) {
        setErrorMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setPresets(sortPresets(result.data));
    } catch {
      const message = "A közös tételek most nem tölthetők be. Próbáld újra.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  const savePreset = form.handleSubmit(async (values) => {
    if (busy) return;
    if (values.amountMinor === null) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      const result = editingId
        ? await updateExpensePreset({ ...values, amountMinor: values.amountMinor, id: editingId })
        : await createExpensePreset({ ...values, amountMinor: values.amountMinor });
      if (!result.success) {
        setErrorMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setPresets((current) => sortPresets(editingId
        ? current.map((preset) => preset.id === result.data.id ? result.data : preset)
        : [...current, result.data]));
      resetEditor();
      toast.success(editingId ? "A közös tételsablon frissült." : "A közös tételsablon létrejött.");
    } catch {
      const message = "A közös tétel most nem menthető. Próbáld újra.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  });

  const editPreset = (preset: ExpensePresetDto) => {
    if (busy) return;
    setEditingId(preset.id);
    setAmountEntryError(null);
    setAmountText(formatMinorAsHuf(preset.amountMinor));
    form.reset({ name: preset.name, amountMinor: preset.amountMinor, isDefault: preset.isDefault });
  };

  const removePreset = async (preset: ExpensePresetDto) => {
    if (busy) return;
    if (!window.confirm(`Törlöd a közös „${preset.name}” sablont? A már felvett havi tételek nem változnak.`)) return;
    setDeletingId(preset.id);
    setErrorMessage(null);
    try {
      const result = await deleteExpensePreset(preset.id);
      if (!result.success) {
        setErrorMessage(result.error.message);
        toast.error(result.error.message);
        return;
      }
      setPresets((current) => current.filter((item) => item.id !== result.data.id));
      if (editingId === result.data.id) resetEditor();
      toast.success("A közös tételsablon törölve.");
    } catch {
      const message = "A közös tétel most nem törölhető. Próbáld újra.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="h-fit rounded-[22px] border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="preset-form-heading">
          <div className="mb-5 flex items-center gap-3"><span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-sky-50 text-primary"><Plus className="size-5" /></span><div><h2 id="preset-form-heading" className="text-xl font-semibold tracking-tight text-foreground">{editingId ? "Közös tétel szerkesztése" : "Új közös tétel"}</h2><p className="text-sm text-muted-foreground">Közösen használt havi sablon</p></div></div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">A sablon közös; módosítása nem írja át a már felvett havi tételeket.</p>
          {errorMessage && <p role="alert" className="mt-4 rounded-xl border border-primary/25 bg-note-peach/60 p-3 text-sm text-foreground">{errorMessage}</p>}
          <form noValidate onSubmit={savePreset} className="mt-5">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-80">
            <div>
              <label htmlFor="preset-name" className="mb-1 block text-sm font-medium text-foreground">Tétel neve</label>
              <input id="preset-name" maxLength={120} {...form.register("name")} aria-invalid={Boolean(form.formState.errors.name)} aria-describedby={form.formState.errors.name ? "preset-name-error" : undefined} className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring" />
              {form.formState.errors.name && <p id="preset-name-error" role="alert" className="mt-1 text-xs text-primary">{form.formState.errors.name.message}</p>}
            </div>
            <Controller
              control={form.control}
              name="amountMinor"
              render={({ field, fieldState }) => (
                <div>
                  <label htmlFor="preset-amount" className="mb-1 block text-sm font-medium text-foreground">Összeg forintban</label>
                  <div className="relative">
                    <input
                      id="preset-amount"
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
                      aria-invalid={Boolean(amountEntryError) || fieldState.invalid}
                      aria-describedby={amountEntryError || fieldState.error ? "preset-amount-error" : undefined}
                      placeholder="0"
                      className="min-h-11 w-full rounded-lg border border-border bg-background px-3 pr-9 text-right tabular-nums text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    />
                    <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Ft</span>
                  </div>
                  {(amountEntryError || fieldState.error) && <p id="preset-amount-error" role="alert" className="mt-1 text-xs text-primary">{amountEntryError ?? fieldState.error?.message}</p>}
                </div>
              )}
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" {...form.register("isDefault")} className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring" />
              Alapértelmezett az új kimutatásokban
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:brightness-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{saving ? "Mentés…" : editingId ? "Módosítás mentése" : "Tétel mentése"}</button>
              {editingId && <button type="button" onClick={() => { if (!busy) resetEditor(); }} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-note-yellow/50 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Mégse</button>}
            </div>
            </fieldset>
          </form>
        </section>

        <section className="rounded-[22px] border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="preset-list-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="preset-list-heading" className="text-xl font-semibold tracking-tight text-foreground">Mentett közös tételek</h2>
            <button type="button" onClick={() => void refreshPresets()} disabled={busy} aria-label="Mentett tételek frissítése" title="Mentett tételek frissítése" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring">
              <RefreshCw aria-hidden="true" className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {presets.map((preset) => (
              <li key={preset.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">{preset.name}{preset.isDefault && <span className="ml-2 inline-flex rounded-full bg-note-sage px-2 py-0.5 align-middle text-[10px] font-medium text-foreground">Alapértelmezett</span>}</span>
                <span className="shrink-0 text-sm tabular-nums text-foreground">{formatMinorAsHuf(preset.amountMinor)} Ft</span>
                <div className="col-span-2 ml-auto flex items-center gap-1">
                  <button type="button" onClick={() => editPreset(preset)} disabled={busy} aria-label={`${preset.name} szerkesztése`} className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-note-yellow/50 hover:text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring">Szerkesztés</button>
                  <button type="button" onClick={() => void removePreset(preset)} disabled={busy} aria-label={`${preset.name} törlése`} className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-note-peach/60 hover:text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring"><Trash2 aria-hidden="true" className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
          {presets.length === 0 && !errorMessage && <p className="mt-4 text-sm text-muted-foreground">Még nincs mentett közös tételsablon.</p>}
          {presets.length >= 100 && <p className="mt-4 text-xs text-muted-foreground">Elérted a 100 közös tételsablonos korlátot.</p>}
        </section>
      </div>
    </>
  );
};

export default PresetSettingsForm;
