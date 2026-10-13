"use client";

import { useMemo, useState, type FC } from "react";
import { CalendarRange, Droplets, Flame, MoreHorizontal, Trash2, Zap, type LucideIcon } from "lucide-react";
import type { UtilityHistoryMonth } from "../types";

type UtilityCategory = UtilityHistoryMonth["series"][number]["category"];
type UtilityUnit = NonNullable<UtilityHistoryMonth["series"][number]["unit"]>;
type ChartMode = "consumption" | "cost";

interface UtilityHistoryChartProps {
  history: UtilityHistoryMonth[];
  error: string | null;
  endMonth: string;
}

const categories: { value: UtilityCategory; label: string; color: string; tone: string; icon: LucideIcon }[] = [
  { value: "water", label: "Víz", color: "text-sky-800", tone: "bg-sky-50", icon: Droplets },
  { value: "gas", label: "Gáz", color: "text-rose-800", tone: "bg-rose-50", icon: Flame },
  { value: "electricity", label: "Villany", color: "text-amber-800", tone: "bg-amber-50", icon: Zap },
  { value: "waste", label: "Hulladék", color: "text-emerald-800", tone: "bg-emerald-50", icon: Trash2 },
  { value: "other", label: "Egyéb", color: "text-slate-800", tone: "bg-slate-100", icon: MoreHorizontal },
];

const preferredUnits: Partial<Record<UtilityCategory, UtilityUnit>> = { water: "m3", gas: "m3", electricity: "kWh" };
const unitLabels: Record<UtilityUnit, string> = { m3: "m³", kWh: "kWh", MJ: "MJ", kg: "kg", l: "l", piece: "db" };

const monthKeyAtOffset = (monthKey: string, offset: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (monthKey: string, year = false) => {
  const [yearNumber, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("hu-HU", { month: "short", ...(year ? { year: "numeric" as const } : {}), timeZone: "UTC" }).format(new Date(Date.UTC(yearNumber, month - 1, 1)));
};

const formatConsumption = (value: number, unit: UtilityUnit) =>
  `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(value)} ${unitLabels[unit]}`;

const formatCost = (minor: number) => new Intl.NumberFormat("hu-HU", {
  style: "currency", currency: "HUF", maximumFractionDigits: 0,
}).format(minor / 100);

const UtilityHistoryChart: FC<UtilityHistoryChartProps> = ({ history, error, endMonth }) => {
  const [category, setCategory] = useState<UtilityCategory>("water");
  const [mode, setMode] = useState<ChartMode>("consumption");
  const [monthCount, setMonthCount] = useState<6 | 12>(6);
  const [unitByCategory, setUnitByCategory] = useState<Partial<Record<UtilityCategory, UtilityUnit>>>({});
  const months = useMemo(() => Array.from({ length: monthCount }, (_, index) => monthKeyAtOffset(endMonth, index - monthCount + 1)), [endMonth, monthCount]);
  const availableUnits = Array.from(new Set(history.filter((month) => months.includes(month.reportMonth)).flatMap((month) => month.series
    .filter((entry) => entry.category === category && entry.unit !== null)
    .map((entry) => entry.unit as UtilityUnit))));
  const unit = unitByCategory[category] && availableUnits.includes(unitByCategory[category]!)
    ? unitByCategory[category]!
    : preferredUnits[category] && availableUnits.includes(preferredUnits[category]!)
      ? preferredUnits[category]!
      : availableUnits[0] ?? null;

  const points = months.map((reportMonth) => {
    const month = history.find((item) => item.reportMonth === reportMonth);
    const categorySeries = month?.series.filter((entry) => entry.category === category) ?? [];
    const matching = mode === "cost"
      ? categorySeries.filter((entry) => entry.unit === null)
      : categorySeries.filter((entry) => entry.unit === unit);
    const values = matching.map((entry) => mode === "cost" ? entry.costMinor : entry.consumption)
      .filter((value): value is number => value !== null);
    return {
      reportMonth,
      value: matching.length > 0 && values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null,
      incompleteConsumptionCount: matching.reduce((sum, entry) => sum + entry.missingConsumptionCount, 0),
      excludedCostCount: matching.reduce((sum, entry) => sum + entry.excludedCostCount, 0),
      hasReport: Boolean(month),
    };
  });
  const values = points.flatMap((point) => point.value === null ? [] : [point.value]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const latestPoint = points.at(-1);
  const knownMonthCount = values.length;
  const missingMonthCount = monthCount - knownMonthCount;
  const totalOverflow = mode === "cost" && !Number.isSafeInteger(total);
  const maxValue = Math.max(...values, 0);
  const axisMax = maxValue > 0 ? maxValue * 1.18 : 1;
  const width = 920;
  const height = 320;
  const plot = { left: 54, right: 12, top: 24, bottom: 50 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const step = plotWidth / points.length;
  const barWidth = Math.min(48, step * 0.58);
  const incompleteCount = points.reduce((sum, point) => sum + point.incompleteConsumptionCount, 0);
  const excludedCount = points.reduce((sum, point) => sum + point.excludedCostCount, 0);
  const categoryInfo = categories.find((item) => item.value === category)!;
  const CategoryIcon = categoryInfo.icon;
  const showValue = (value: number | null) => value === null
    ? "Nincs adat"
    : mode === "cost" ? formatCost(value) : unit ? formatConsumption(value, unit) : "Nincs mértékegység";
  const windowLabel = `${monthLabel(months[0], true)} – ${monthLabel(endMonth, true)}`;

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="utility-history-title">
      <div className="rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-11 flex-wrap items-center gap-2" role="group" aria-label="Közműkategória">
            {categories.map((item) => {
              const Icon = item.icon;
              return <button key={item.value} type="button" aria-pressed={category === item.value} onClick={() => setCategory(item.value)} className={`inline-flex min-h-11 flex-wrap items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${category === item.value ? `${item.tone} ${item.color} border-current` : "border-border bg-background text-muted-foreground hover:bg-muted"}`}><Icon aria-hidden="true" className="size-4" /><span>{item.label}</span></button>;
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="Megjelenített érték">
              {([ ["consumption", "Fogyasztás"], ["cost", "Költség"] ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${mode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>{label}</button>)}
            </div>
            <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="Diagram időszaka">
              {([6, 12] as const).map((count) => <button key={count} type="button" aria-pressed={monthCount === count} onClick={() => setMonthCount(count)} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${monthCount === count ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}>{count} hó</button>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section className="rounded-[22px] border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="utility-history-title">
          <div className="flex items-start justify-between gap-3">
            <div><h2 id="utility-history-title" className="text-lg font-semibold tracking-tight text-foreground">{monthLabel(endMonth, true)}</h2><p className="mt-1 text-sm text-muted-foreground">{windowLabel} · {categoryInfo.label}</p></div>
            <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${categoryInfo.tone} ${categoryInfo.color}`}><CategoryIcon aria-hidden="true" className="size-5" /></span>
          </div>
          <p className="mt-6 text-sm font-medium text-muted-foreground">{mode === "cost" ? "Ismert költség összesen" : `Ismert fogyasztás összesen${unit ? ` · ${unitLabels[unit]}` : ""}`}</p>
          <p className="mt-1 break-words text-4xl font-bold tracking-tight tabular-nums text-foreground sm:text-5xl">{totalOverflow ? "Nem számítható" : knownMonthCount ? showValue(total) : "Nincs adat"}</p>
          <p className="mt-2 text-sm text-muted-foreground">{knownMonthCount} ismert hónap a kiválasztott {monthCount} naptári hónapból</p>

          {error ? <p role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">Az előzmény most nem tölthető be. {error}</p> : (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className={`rounded-xl p-3 ${categoryInfo.tone}`}><p className="text-xs text-muted-foreground">{monthLabel(endMonth)} · aktuális</p><p className="mt-1 font-semibold tabular-nums text-foreground">{showValue(latestPoint?.value ?? null)}</p></div>
              <div className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">Havi átlag</p><p className="mt-1 font-semibold tabular-nums text-foreground">{totalOverflow ? "Nem számítható" : knownMonthCount ? showValue(total / knownMonthCount) : "Nincs adat"}</p></div>
              <div className="rounded-xl bg-muted p-3"><p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarRange aria-hidden="true" className="size-3.5" /> Lefedettség</p><p className="mt-1 font-semibold tabular-nums text-foreground">{knownMonthCount}/{monthCount}</p><p className="text-xs text-muted-foreground">{missingMonthCount ? `${missingMonthCount} hónap hiányzik` : `adat van mind a ${monthCount} hónapra`}</p></div>
            </div>
          )}
          {(mode === "consumption" ? incompleteCount : excludedCount) > 0 && <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{mode === "consumption" ? `${incompleteCount} számla nem adott használható fogyasztási adatot.` : `${excludedCount} tétel nem számít bele az ismert költségbe.`}</p>}
        </section>

        <section className="min-w-0 rounded-[22px] border border-border bg-card p-4 shadow-sm sm:p-5" aria-label={`Havi ${mode === "cost" ? "költség" : "fogyasztás"} diagram · ${categoryInfo.label}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-lg font-semibold tracking-tight text-foreground">Havi {mode === "cost" ? "költség" : "fogyasztás"} – {categoryInfo.label}</h3><p className="mt-1 text-sm text-muted-foreground">{mode === "cost" ? "Forintban, a számlák elszámolási hónapja szerint" : `A számlák elszámolási hónapja szerint${unit ? ` · ${unitLabels[unit]}` : ""}`}</p></div>
            {mode === "consumption" && availableUnits.length > 1 && <label className="flex items-center gap-2 text-sm text-muted-foreground">Egység<select aria-label="Fogyasztási egység" value={unit ?? ""} onChange={(event) => setUnitByCategory((current) => ({ ...current, [category]: event.target.value as UtilityUnit }))} className="min-h-11 rounded-lg border border-border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring">{availableUnits.map((item) => <option key={item} value={item}>{unitLabels[item]}</option>)}</select></label>}
          </div>
          {error ? <p role="alert" className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">A diagram adatai most nem tölthetők be.</p> : (
            <>
              <div className="mt-4 w-full min-w-0 rounded-2xl bg-background px-1 py-3 sm:px-2">
                <svg aria-hidden="true" className="block h-auto w-full min-w-0" viewBox={`0 0 ${width} ${height}`} role="presentation">
                  {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = plot.top + plotHeight * (1 - fraction);
                    const axisValue = axisMax * fraction;
                    const axisLabel = mode === "cost" ? formatCost(axisValue) : new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(axisValue);
                    return <g key={fraction}><line x1={plot.left} x2={width - plot.right} y1={y} y2={y} className="stroke-border" /><text x={plot.left - 7} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize={monthCount === 12 ? "10" : "12"}>{axisLabel}</text></g>;
                  })}
                  {points.map((point, index) => {
                    const x = plot.left + step * index + (step - barWidth) / 2;
                    const barHeight = point.value === null ? 0 : (point.value / axisMax) * plotHeight;
                    const hideMonthLabel = monthCount === 12 && index % 2 === 1 && index !== points.length - 1;
                    return <g key={point.reportMonth}>
                      {point.value !== null ? <rect x={x} y={plot.top + plotHeight - barHeight} width={barWidth} height={Math.max(2, barHeight)} rx="7" className={index === points.length - 1 ? "fill-primary" : "fill-sky-300"}><title>{`${monthLabel(point.reportMonth, true)}: ${showValue(point.value)}`}</title></rect> : <line x1={x} x2={x + barWidth} y1={plot.top + plotHeight} y2={plot.top + plotHeight} strokeDasharray="3 3" className="stroke-border"><title>{`${monthLabel(point.reportMonth, true)}: ${point.hasReport ? "Nincs összeadható adat" : "Nincs mentett kimutatás"}`}</title></line>}
                      {!hideMonthLabel && <text x={x + barWidth / 2} y={height - 16} textAnchor="middle" className="fill-muted-foreground" fontSize={monthCount === 12 ? "10" : "12"}>{monthLabel(point.reportMonth)}</text>}
                    </g>;
                  })}
                </svg>
              </div>
              <details className="mt-3 rounded-xl border border-border px-3 py-2"><summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Diagram adatai szövegként</summary><div className="overflow-x-auto"><table className="w-full min-w-[320px] text-left text-sm"><caption className="sr-only">{categoryInfo.label} {mode === "cost" ? "költség" : `fogyasztás (${unit ? unitLabels[unit] : "egység nélkül"})`}, {monthCount} naptári hónap</caption><thead><tr className="border-b border-border text-muted-foreground"><th scope="col" className="py-2 pr-4">Elszámolási hónap</th><th scope="col" className="py-2">{mode === "cost" ? "Költség" : `Fogyasztás (${unit ? unitLabels[unit] : "—"})`}</th></tr></thead><tbody>{points.map((point) => <tr key={point.reportMonth} className="border-b border-border last:border-0"><th scope="row" className="py-2 pr-4 font-normal">{monthLabel(point.reportMonth, true)}</th><td className="py-2">{showValue(point.value)}</td></tr>)}</tbody></table></div></details>
            </>
          )}
        </section>
      </div>
    </section>
  );
};

export default UtilityHistoryChart;
