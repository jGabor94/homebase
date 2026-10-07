const getTimeZoneParts = (instant: number, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));

  return Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)])) as Record<string, number>;
};

const zonedDateTimeToUtc = (year: number, month: number, day: number, timeZone: string) => {
  const nominalUtc = Date.UTC(year, month - 1, day);
  let estimate = nominalUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = getTimeZoneParts(estimate, timeZone);
    const observedUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    estimate += nominalUtc - observedUtc;
  }

  return estimate;
};

export const getBudapestMonthWindow = (year: number, month: number) => {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Érvénytelen hónap.");
  }

  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const startMs = zonedDateTimeToUtc(year, month, 1, "Europe/Budapest");
  const endMs = zonedDateTimeToUtc(nextMonthYear, nextMonth, 1, "Europe/Budapest");
  const paddingSeconds = 2 * 24 * 60 * 60;

  return {
    startMs,
    endMs,
    afterSeconds: Math.floor(startMs / 1000) - paddingSeconds,
    beforeSeconds: Math.ceil(endMs / 1000) + paddingSeconds,
  };
};

export const toMonthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export const parseValidMailDate = (value: string | null | undefined) => {
  if (!value?.trim()) return null;
  // RFC mail dates may end in comments; the explicit numeric offset remains authoritative.
  const date = value.trim().replace(/(?:\s*\([^()]*\))+\s*$/u, "").trim();
  const hasExplicitTimeAndZone = /\b\d{1,2}:\d{2}(?::\d{2})?\b/u.test(date)
    && /(?:Z|[+-]\d{2}:?\d{2}|\b(?:GMT|UTC)\b)\s*$/iu.test(date);
  if (!hasExplicitTimeAndZone) return null;
  const parsed = Date.parse(date);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

export const parseHungarianInvoiceDate = (value: string | null | undefined) => {
  if (!value?.trim()) return null;
  const input = value.trim();
  let parts: [number, number, number] | null = null;
  let match = input.match(/\b(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})\.?/u);
  if (match) parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!parts) {
    match = input.match(/\b(\d{1,2})[./-]\s*(\d{1,2})[./-]\s*(\d{4})\.?/u);
    if (match) parts = [Number(match[3]), Number(match[2]), Number(match[1])];
  }
  if (!parts) return null;

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export const isDateInMonthWindow = (dateIso: string | null, year: number, month: number) => {
  if (!dateIso) return false;
  const date = Date.parse(dateIso);
  if (!Number.isFinite(date)) return false;
  const { startMs, endMs } = getBudapestMonthWindow(year, month);
  return date >= startMs && date < endMs;
};
