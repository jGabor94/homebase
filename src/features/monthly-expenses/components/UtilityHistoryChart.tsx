"use client";

import { useState, type FC } from "react";
import { Button } from "@/components/ui/button";
import type { UtilityHistoryMonth } from "../types";

type UtilityCategory = UtilityHistoryMonth["series"][number]["category"];
type UtilityUnit = NonNullable<UtilityHistoryMonth["series"][number]["unit"]>;
type ChartMode = "consumption" | "cost";

interface UtilityHistoryChartProps {
  history: UtilityHistoryMonth[];
  error: string | null;
}

const categories: { value: UtilityCategory; label: string }[] = [
  { value: "water", label: "Víz" },
  { value: "gas", label: "Gáz" },
  { value: "electricity", label: "Villany" },
  { value: "waste", label: "Hulladék" },
  { value: "other", label: "Egyéb" },
];

const preferredUnits: Partial<Record<UtilityCategory, UtilityUnit>> = {
  water: "m3",
  gas: "m3",
  electricity: "kWh",
};

const unitLabels: Record<UtilityUnit, string> = {
  m3: "m³",
  kWh: "kWh",
  MJ: "MJ",
  kg: "kg",
  l: "l",
  piece: "db",
};

const monthLabel = (reportMonth: string, options?: Intl.DateTimeFormatOptions) => {
  const [year, month] = reportMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return new Intl.DateTimeFormat("hu-HU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(date);
};

const formatConsumption = (value: number, unit: UtilityUnit) =>
  `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 2 }).format(value)} ${unitLabels[unit]}`;

const formatCost = (minor: number) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 2,
  }).format(minor / 100);

const niceStep = (value: number) => {
  if (value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return niceFraction * magnitude;
};

const formatTick = (value: number, mode: ChartMode, step: number) => {
  const displayValue = mode === "cost" ? value / 100 : value;
  const displayStep = mode === "cost" ? step / 100 : step;
  const precision = Math.min(6, Math.max(0, -Math.floor(Math.log10(displayStep))));

  if (mode === "cost") {
    return new Intl.NumberFormat("hu-HU", {
      notation: displayValue >= 1_000_000 ? "compact" : "standard",
      maximumFractionDigits: precision,
    }).format(displayValue);
  }

  return new Intl.NumberFormat("hu-HU", { maximumFractionDigits: precision }).format(displayValue);
};

const UtilityHistoryChart: FC<UtilityHistoryChartProps> = ({ history, error }) => {

  const [category, setCategory] = useState<UtilityCategory>("water");
  const [mode, setMode] = useState<ChartMode>("consumption");
  const [unitByCategory, setUnitByCategory] = useState<Partial<Record<UtilityCategory, UtilityUnit>>>({});

  const months = [...history].sort((left, right) => left.reportMonth.localeCompare(right.reportMonth)).slice(-12);
  const availableUnits = Array.from(
    new Set(
      months.flatMap((month) =>
        month.series
          .filter((entry) => entry.category === category && entry.unit !== null)
          .map((entry) => entry.unit as UtilityUnit),
      ),
    ),
  );
  const requestedUnit = unitByCategory[category];
  const unit = requestedUnit && availableUnits.includes(requestedUnit)
    ? requestedUnit
    : preferredUnits[category] && availableUnits.includes(preferredUnits[category]!)
      ? preferredUnits[category]!
      : availableUnits[0] ?? null;
  const points = months.map((month) => {
    const categorySeries = month.series.filter((entry) => entry.category === category);
    const physicalSeries = categorySeries.filter((entry) => entry.unit === unit);
    const matchingSeries = mode === "cost"
      ? categorySeries.filter((entry) => entry.unit === null)
      : physicalSeries.length > 0
        ? physicalSeries
        : categorySeries.filter((entry) => entry.unit === null);
    const values = matchingSeries
      .map((entry) => (mode === "cost" ? entry.costMinor : entry.consumption))
      .filter((value): value is number => value !== null);
    const value = matchingSeries.length > 0 && values.length > 0
      ? values.reduce((total, current) => total + current, 0)
      : null;

    return {
      reportMonth: month.reportMonth,
      value,
      missingConsumptionCount: matchingSeries.reduce((total, entry) => total + entry.missingConsumptionCount, 0),
      excludedCostCount: matchingSeries.reduce((total, entry) => total + entry.excludedCostCount, 0),
    };
  });
  const values = points.flatMap((point) => point.value === null ? [] : [point.value]);
  const maxValue = Math.max(...values, 0);
  const tickStep = mode === "cost" ? Math.max(1, niceStep(maxValue / 4)) : niceStep(maxValue / 4);
  const axisMax = Math.max(tickStep, Math.ceil(maxValue / tickStep) * tickStep);
  const tickCount = Math.round(axisMax / tickStep);
  const partialConsumptionCount = points.reduce((total, point) => total + point.missingConsumptionCount, 0);
  const excludedCostCount = points.reduce((total, point) => total + point.excludedCostCount, 0);
  const hasChartData = values.length > 0;
  const width = 920;
  const height = 340;
  const plot = { left: 82, right: 18, top: 20, bottom: 58 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const step = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.min(38, step * 0.58);

  const accessibleRows = points.map((point) => ({
    month: monthLabel(point.reportMonth),
    value: point.value === null
      ? "Nincs rögzített adat"
      : mode === "cost"
        ? formatCost(point.value)
        : formatConsumption(point.value, unit!),
  }));

  return (
    <section className="rounded-[20px] border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="utility-history-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="utility-history-title" className="font-serif text-2xl text-foreground">Közművek alakulása</h2>
          <p className="mt-1 text-sm text-muted-foreground">A mentett kimutatások legutóbbi 12 hónapja</p>
        </div>
        <div className="flex min-h-11 flex-wrap gap-2" role="group" aria-label="Diagram nézete">
          <Button type="button" variant={mode === "consumption" ? "default" : "outline"} className="h-11" aria-pressed={mode === "consumption"} onClick={() => setMode("consumption")}>
            Fogyasztás
          </Button>
          <Button type="button" variant={mode === "cost" ? "default" : "outline"} className="h-11" aria-pressed={mode === "cost"} onClick={() => setMode("cost")}>
            Költség
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Közműkategória">
        {categories.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant={category === item.value ? "secondary" : "outline"}
            className="h-11 min-w-11"
            aria-pressed={category === item.value}
            onClick={() => setCategory(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {mode === "consumption" && availableUnits.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Mértékegység">
          <span className="mr-1 text-sm text-muted-foreground">Mértékegység:</span>
          {availableUnits.map((availableUnit) => (
            <Button
              key={availableUnit}
              type="button"
              variant={unit === availableUnit ? "secondary" : "outline"}
              className="h-11 min-w-11"
              aria-pressed={unit === availableUnit}
              onClick={() => setUnitByCategory((previous) => ({ ...previous, [category]: availableUnit }))}
            >
              {unitLabels[availableUnit]}
            </Button>
          ))}
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-border bg-background px-4 py-4 text-sm text-foreground">
          A fogyasztási előzmény most nem tölthető be. {error}
        </p>
      ) : history.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center">
          <p className="font-medium text-foreground">Még nincs mentett kimutatás</p>
          <p className="mt-1 text-sm text-muted-foreground">A diagram a mentett hónapok adataiból készül.</p>
        </div>
      ) : !hasChartData ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-background px-5 py-10 text-center">
          <p className="font-medium text-foreground">Ehhez a nézethez még nincs megjeleníthető adat</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "consumption" ? "Nyiss meg egy kimutatást és add meg a számlák fogyasztását." : "A mentett hónapok még nem tartalmaznak költségadatot."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto rounded-2xl bg-background px-2 py-4 sm:px-4">
            <svg
              aria-hidden="true"
              className="block min-w-[640px] max-w-none"
              width="100%"
              viewBox={`0 0 ${width} ${height}`}
              role="presentation"
            >
              {Array.from({ length: tickCount + 1 }, (_, tick) => {
                const value = tickStep * tick;
                const y = plot.top + plotHeight - (value / axisMax) * plotHeight;

                return (
                  <g key={tick}>
                    <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} className="stroke-border" strokeWidth="1" />
                    <text x={plot.left - 10} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="12">
                      {formatTick(value, mode, tickStep)}
                    </text>
                  </g>
                );
              })}
              {points.map((point, index) => {
                const x = plot.left + step * index + (step - barWidth) / 2;
                const barHeight = point.value === null ? 0 : (point.value / axisMax) * plotHeight;
                const y = point.value === 0 ? plot.top + plotHeight - 2 : plot.top + plotHeight - barHeight;
                const displayMonth = monthLabel(point.reportMonth, { month: "short" });

                return (
                  <g key={point.reportMonth}>
                    {point.value !== null && (
                      <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx="5" className="fill-accent">
                        <title>{`${monthLabel(point.reportMonth)}: ${mode === "cost" ? formatCost(point.value) : formatConsumption(point.value, unit!)}`}</title>
                      </rect>
                    )}
                    <text x={x + barWidth / 2} y={height - 22} textAnchor="middle" className="fill-muted-foreground" fontSize="12">
                      {displayMonth}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {categories.find((item) => item.value === category)?.label} · {mode === "cost" ? "költség, Ft" : `fogyasztás, ${unit ? unitLabels[unit] : "mértékegység"}`}. A hónap az elszámolás hónapja; eltérhet a fogyasztási időszaktól.
          </p>
          {(mode === "consumption" ? partialConsumptionCount > 0 : excludedCostCount > 0) && (
            <p className="mt-2 rounded-xl bg-note-yellow px-4 py-3 text-sm text-foreground">
              {mode === "consumption"
                ? `${partialConsumptionCount} számlánál hiányzik a fogyasztási adat.`
                : `${excludedCostCount} tétel nem szerepel a költségösszegben.`}
            </p>
          )}
          <details className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Diagram adatai szövegként
            </summary>
            <div className="overflow-x-auto pb-1">
              <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                <caption className="sr-only">{categories.find((item) => item.value === category)?.label} havi {mode === "cost" ? "költség" : "fogyasztás"} adatai</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Elszámolási hónap</th>
                    <th scope="col" className="py-2 font-medium">{mode === "cost" ? "Költség" : `Fogyasztás (${unit ? unitLabels[unit] : "—"})`}</th>
                  </tr>
                </thead>
                <tbody>
                  {accessibleRows.map((row) => (
                    <tr key={row.month} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pr-4 font-normal text-foreground">{row.month}</th>
                      <td className="py-2 text-foreground">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
};

export default UtilityHistoryChart;
