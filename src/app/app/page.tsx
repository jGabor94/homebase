import type { FC } from "react";
import {
  CalendarDays,
  Droplets,
  FileText,
  Flame,
  House,
  LockKeyhole,
  Plus,
  Sun,
  Trash2,
  UsersRound,
  Zap,
} from "lucide-react";

const bills = [
  { label: "MVM · Gáz", amount: 12_400, Icon: Flame },
  { label: "MVM · Villany", amount: 18_600, Icon: Zap },
  { label: "ALFÖLDVÍZ", amount: 8_200, Icon: Droplets },
  { label: "MOHU", amount: 4_800, Icon: Trash2 },
];
const loanPayment = 81_000;

const monthlyUtilities = [
  { month: "Ápr", amount: 34_000 },
  { month: "Máj", amount: 45_000 },
  { month: "Jún", amount: 59_000 },
  { month: "Júl", amount: 49_000 },
  { month: "Aug", amount: 38_000 },
  { month: "Szept", amount: 44_000 },
];

const notes = [
  {
    title: "Bevásárlás",
    content: ["Tej és kenyér", "Mosogatószer", "Gyümölcs"],
    updated: "Ma frissítve",
    privacy: "Családi",
    tone: "bg-note-yellow",
  },
  {
    title: "Hétvégi program",
    content: ["Szombaton közös ebéd, utána séta."],
    updated: "Tegnap",
    privacy: "Családi",
    tone: "bg-note-peach",
  },
  {
    title: "Ötletek",
    content: ["Erkély rendbetétele", "Új polc a dolgozószobába"],
    updated: "3 napja",
    privacy: "Privát",
    tone: "bg-note-sage",
  },
];

const formatForint = (amount: number) =>
  `${new Intl.NumberFormat("hu-HU").format(amount)} Ft`;

const DashboardPage: FC = () => {
  const utilitiesTotal = bills.reduce((total, bill) => total + bill.amount, 0);
  const monthlyTotal = utilitiesTotal + loanPayment;

  return (
    <>

      <main id="attekintes" className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
        <section className="mb-6 flex flex-col justify-between gap-5 sm:mb-7 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="font-serif text-[clamp(3rem,6vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.045em] text-foreground">
                Jó itthon.
              </h1>
              <Sun aria-hidden="true" className="size-12 text-amber-500 sm:size-14" strokeWidth={1.4} />
            </div>
            <p className="mt-1 text-lg text-muted-foreground sm:text-xl">
              Számlák, tervek és minden, ami közös.
            </p>
          </div>
          <div className="flex min-h-14 w-fit items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm text-foreground shadow-sm sm:px-5 sm:text-base">
            <CalendarDays aria-hidden="true" className="size-5 text-primary" />
            <span>2026. szeptember</span>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <section
            id="kozos"
            aria-labelledby="monthly-heading"
            className="rounded-[20px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(91,61,36,0.06)] sm:p-7"
          >
            <h2 id="monthly-heading" className="font-serif text-[28px] font-semibold leading-tight text-foreground">
              A havi közös
            </h2>
            <p className="mt-1 text-base text-muted-foreground">Szeptemberi elszámolás</p>

            <ul className="mt-3" aria-label="Szeptemberi számlák">
              {bills.map(({ label, amount, Icon }) => (
                <li key={label} className="flex min-h-11 items-center gap-4 border-b border-border/80 text-[15px] sm:text-base">
                  <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" strokeWidth={1.8} />
                  <span>{label}</span>
                  <span className="ml-auto tabular-nums">{formatForint(amount)}</span>
                </li>
              ))}
              <li className="flex min-h-11 items-center gap-4 border-b border-border/80 text-[15px] sm:text-base">
                <House aria-hidden="true" className="size-6 shrink-0 text-primary" strokeWidth={1.8} />
                <span>Hitel</span>
                <span className="ml-auto tabular-nums">{formatForint(loanPayment)}</span>
              </li>
            </ul>

            <dl className="mt-2 space-y-1 text-base sm:text-lg">
              <div className="flex min-h-11 items-center justify-between border-b border-border/80 font-semibold">
                <dt>Összesen</dt>
                <dd className="tabular-nums">{formatForint(monthlyTotal)}</dd>
              </div>
              <div className="flex min-h-11 items-center justify-between">
                <dt>Utalandó fele</dt>
                <dd className="font-semibold tabular-nums">{formatForint(monthlyTotal / 2)}</dd>
              </div>
            </dl>

            <details className="group mt-3">
              <summary className="flex min-h-12 w-fit cursor-pointer list-none items-center gap-3 rounded-xl bg-primary px-5 text-primary-foreground shadow-sm transition-[filter] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <FileText aria-hidden="true" className="size-5" />
                Kimutatás megnyitása
              </summary>
              <div className="mt-3 rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Szeptemberi minta kimutatás</p>
                <p className="mt-1">Közművek: {formatForint(utilitiesTotal)} · Hitel: {formatForint(loanPayment)}</p>
                <p className="mt-1">Teljes összeg: {formatForint(monthlyTotal)} · Fejenként: {formatForint(monthlyTotal / 2)}</p>
              </div>
            </details>
          </section>

          <section
            id="rezsi"
            aria-labelledby="utilities-heading"
            className="rounded-[20px] border border-border bg-card p-5 shadow-[0_8px_24px_rgba(91,61,36,0.06)] sm:p-7"
          >
            <h2 id="utilities-heading" className="font-serif text-[28px] font-semibold leading-tight text-foreground">
              Így alakult a rezsi
            </h2>
            <p className="mt-1 text-base text-muted-foreground">Közművek · hitel nélkül</p>

            <figure className="mt-5" aria-labelledby="chart-caption">
              <figcaption id="chart-caption" className="sr-only">
                Hat havi közműköltség, forintban. A szeptemberi érték 44 000 forint.
              </figcaption>
              <div className="flex h-[190px] gap-3" aria-hidden="true">
                <div className="flex h-full flex-col justify-between text-xs text-muted-foreground">
                  <span>80 000</span><span>60 000</span><span>40 000</span><span>20 000</span><span>0</span>
                </div>
                <div className="relative flex h-full flex-1 items-end justify-around border-b border-l border-border px-1">
                  <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                    {[80_000, 60_000, 40_000, 20_000].map((value) => (
                      <span
                        key={value}
                        className="absolute left-0 right-0 border-t border-border/80"
                        style={{ top: `${100 - (value / 80_000) * 100}%` }}
                      />
                    ))}
                  </div>
                  {monthlyUtilities.map(({ month, amount }) => (
                    <div key={month} className="z-10 flex h-full w-[13%] flex-col items-center justify-end">
                      <div
                        className="w-full rounded-t-[5px] bg-accent/90"
                        style={{ height: `${(amount / 80_000) * 100}%` }}
                      />
                      <span className="absolute -bottom-7 text-xs text-muted-foreground">{month}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="sr-only">
                {monthlyUtilities.map(({ month, amount }) => (
                  <li key={month}>{month}: {formatForint(amount)}</li>
                ))}
              </ul>
            </figure>

            <div className="mt-10 flex min-h-12 items-center justify-between border-t border-border text-base">
              <span>Szeptember</span>
              <strong className="text-lg tabular-nums">{formatForint(utilitiesTotal)}</strong>
            </div>
          </section>
        </div>

        <section id="jegyzetek" aria-labelledby="notes-heading" className="mt-7">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <h2 id="notes-heading" className="font-serif text-[30px] font-semibold leading-tight text-foreground">
                A hűtőajtón
              </h2>
              <p className="text-sm text-muted-foreground sm:text-base">Közös és saját jegyzeteink</p>
            </div>
            <button
              type="button"
              disabled
              title="Jegyzet létrehozása később lesz elérhető."
              className="inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-lg px-2 text-sm font-medium text-accent opacity-75"
            >
              <Plus aria-hidden="true" className="size-5" />
              Új jegyzet
            </button>
          </div>

          <ul className="grid gap-4 md:grid-cols-3">
            {notes.map(({ title, content, updated, privacy, tone }) => (
              <li key={title} className={`min-h-[190px] rounded-[19px] border border-border/70 ${tone} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-foreground">{title}</h3>
                  <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-foreground/[0.06] px-3 text-xs font-medium text-foreground">
                    {privacy === "Privát" ? (
                      <LockKeyhole aria-hidden="true" className="size-4" />
                    ) : (
                      <UsersRound aria-hidden="true" className="size-4" />
                    )}
                    {privacy}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-[15px] leading-6 text-foreground">
                  {content.map((line) => <li key={line}>{line}</li>)}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">{updated}</p>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-7 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Bemutató · mintaadatok
        </footer>
      </main>
    </>
  );
};

export default DashboardPage;
