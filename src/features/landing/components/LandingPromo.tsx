'use client'

import { useState, type FC } from 'react'
import {
  CalendarDays,
  Droplets,
  Flame,
  House,
  LockKeyhole,
  Pause,
  Play,
  ReceiptText,
  ShoppingBasket,
  StickyNote,
  Trash2,
  UsersRound,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import styles from './LandingPromo.module.css'

const LandingPromo: FC = () => {
  const [isPaused, setIsPaused] = useState(false)

  return (
    <figure className="mx-auto w-full">
      <div className={styles.frame} data-paused={isPaused}>
        <div className={styles.stage} aria-hidden="true">
          <div className={`${styles.headline} ${styles.headlineOne}`}>A közös dolgok. Egy helyen.</div>
          <div className={`${styles.headline} ${styles.headlineTwo}`}>Kevesebb matek. Több nyugalom.</div>
          <div className={`${styles.headline} ${styles.headlineThree}`}>Minden, ami közös.</div>

          <article className={`${styles.window} ${styles.dashboard}`}>
            <div className={styles.chrome}>
              <span className={styles.dots}><i /><i /><i /></span>
              <span className={styles.address}>homebase / app</span>
              <span className="text-[9px] text-muted-foreground">● ● ●</span>
            </div>
            <div className="flex h-[calc(100%-29px)] bg-[#faf6ee]">
              <aside className="hidden w-[18%] shrink-0 flex-col border-r border-border bg-card p-3 sm:flex">
                <span className="flex items-center gap-1.5 font-serif text-sm font-semibold text-foreground"><House className="size-4 text-primary" /> homebase</span>
                <div className="mt-6 space-y-3 text-[10px] text-muted-foreground">
                  <p className="flex items-center gap-2 rounded-lg bg-[#f5ebe1] p-2 text-foreground"><House className="size-3.5 text-primary" /> Áttekintés</p>
                  <p className="flex items-center gap-2 px-2"><ReceiptText className="size-3.5" /> Közművek</p>
                  <p className="flex items-center gap-2 px-2"><StickyNote className="size-3.5" /> Jegyzetek</p>
                </div>
                <div className="mt-auto rounded-lg bg-[#edf0dc] p-2 text-[9px] text-[#596242]">Közös otthon</div>
              </aside>
              <div className="min-w-0 flex-1 p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div><h2 className="font-serif text-xl font-semibold leading-none tracking-tight text-foreground sm:text-[27px]">Jó itthon.</h2><p className="mt-1 hidden text-[10px] text-muted-foreground sm:block">Számlák, tervek és minden, ami közös.</p></div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-[9px] text-foreground sm:text-[10px]"><CalendarDays className="size-3 text-primary" /> 2026. szeptember</span>
                </div>
                <div className="mt-3 grid h-[calc(100%-51px)] grid-cols-1 gap-2 sm:mt-4 sm:grid-cols-[1.2fr_0.8fr] sm:gap-3">
                  <section className="min-w-0 rounded-xl border border-border bg-card p-2 sm:p-3">
                    <h3 className="font-serif text-sm font-semibold text-foreground sm:text-base">A havi közös</h3>
                    <div className="mt-1.5 space-y-1.5 text-[9px] sm:mt-2 sm:space-y-2 sm:text-[10px]">
                      <p className="flex items-center gap-1.5"><Flame className="hidden size-3 text-primary sm:block" /> Gáz <b className="ml-auto font-medium tabular-nums">12 400 Ft</b></p>
                      <p className="flex items-center gap-1.5"><Zap className="hidden size-3 text-primary sm:block" /> Villany <b className="ml-auto font-medium tabular-nums">18 600 Ft</b></p>
                      <p className="flex items-center gap-1.5"><Droplets className="hidden size-3 text-primary sm:block" /> Víz <b className="ml-auto font-medium tabular-nums">8 200 Ft</b></p>
                      <p className="flex items-center gap-1.5"><Trash2 className="hidden size-3 text-primary sm:block" /> Hulladék <b className="ml-auto font-medium tabular-nums">4 800 Ft</b></p>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-[#edf0dc] px-2 py-1.5 text-[9px] sm:mt-3 sm:text-[10px]"><span>44 000 Ft <span className="text-muted-foreground">összesen</span></span><b className="font-semibold">Fele: 22 000 Ft</b></div>
                  </section>
                  <section className="hidden min-w-0 rounded-xl border border-border bg-card p-2 sm:block sm:p-3">
                    <h3 className="font-serif text-xs font-semibold text-foreground sm:text-sm">Így alakult a rezsi</h3>
                    <p className="mt-0.5 text-[8px] text-muted-foreground sm:text-[9px]">Közművek · hitel nélkül</p>
                    <div className={`${styles.chart} mt-3 flex items-end justify-around gap-1 px-1 sm:mt-4`}>
                      {[34, 45, 59, 49, 38, 44].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
                    </div>
                    <div className="mt-1 flex justify-around text-[7px] text-muted-foreground sm:text-[8px]"><span>Ápr</span><span>Máj</span><span>Jún</span><span>Júl</span><span>Aug</span><span>Szept</span></div>
                  </section>
                  <section className="col-span-1 flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 sm:col-span-2 sm:gap-3 sm:px-3">
                    <span className="shrink-0 font-serif text-xs font-semibold text-foreground sm:text-sm">A hűtőajtón</span>
                    <span className="flex min-w-0 flex-1 gap-1.5 overflow-hidden text-[8px] sm:gap-2 sm:text-[9px]"><span className="truncate rounded-md bg-[#fff4d6] px-2 py-1">Bevásárlás · Családi</span><span className="truncate rounded-md bg-[#fce9dd] px-2 py-1">Hétvégi program</span><span className="hidden truncate rounded-md bg-[#edf0dc] px-2 py-1 sm:block">Ötletek</span></span>
                  </section>
                </div>
              </div>
            </div>
          </article>

          <article className={`${styles.window} ${styles.invoice}`}>
            <div className={styles.chrome}><span className={styles.dots}><i /><i /><i /></span><span className={styles.address}>homebase / havi közös</span></div>
            <div className="flex h-[calc(100%-29px)] flex-col bg-[#faf6ee] p-2.5 sm:p-3">
              <div className="flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted-foreground"><ReceiptText className="size-4 text-primary" /> HAVI KÖZÖS</span><span className="rounded-full bg-[#edf0dc] px-2.5 py-1 text-[9px] text-[#596242]">Szeptember</span></div>
              <h2 className="mt-2 font-serif text-xl font-semibold text-foreground">Minden elszámolva.</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">Négy számla, egy tiszta kép.</p>
              <div className="mt-2 rounded-xl border border-border bg-card p-2">
                <p className="flex min-h-6 items-center gap-2 border-b border-border text-xs sm:min-h-7"><Flame className="size-4 text-primary" /> Gáz <b className="ml-auto tabular-nums">12 400 Ft</b></p>
                <p className="flex min-h-6 items-center gap-2 border-b border-border text-xs sm:min-h-7"><Zap className="size-4 text-primary" /> Villany <b className="ml-auto tabular-nums">18 600 Ft</b></p>
                <p className="flex min-h-6 items-center gap-2 border-b border-border text-xs sm:min-h-7"><Droplets className="size-4 text-primary" /> Víz <b className="ml-auto tabular-nums">8 200 Ft</b></p>
                <p className="flex min-h-6 items-center gap-2 text-xs sm:min-h-7"><Trash2 className="size-4 text-primary" /> Hulladék <b className="ml-auto tabular-nums">4 800 Ft</b></p>
              </div>
              <div className="mt-auto flex items-end justify-between gap-2 rounded-xl bg-[#edf0dc] p-2"><div><p className="text-[10px] text-[#596242] sm:text-xs">Összesen</p><b className="font-serif text-lg text-foreground sm:text-xl">44 000 Ft</b></div><div className="text-right"><p className="text-[10px] text-[#596242] sm:text-xs">Utalandó fele</p><b className="text-base text-foreground sm:text-lg">22 000 Ft</b></div></div>
            </div>
          </article>

          <article className={`${styles.window} ${styles.notes}`}>
            <div className={styles.chrome}><span className={styles.dots}><i /><i /><i /></span><span className={styles.address}>homebase / jegyzetek · előnézet</span></div>
            <div className="flex h-[calc(100%-29px)] flex-col bg-[#faf6ee] p-3">
              <div className="flex items-center justify-between gap-2"><div><span className="inline-flex items-center gap-1.5 text-[9px] font-medium tracking-wide text-muted-foreground sm:text-[10px]"><StickyNote className="size-3.5 text-primary" /> JEGYZETEINK</span><h2 className="mt-1 font-serif text-xl font-semibold text-foreground sm:text-3xl">A hűtőajtón</h2></div><span className="shrink-0 rounded-full bg-[#fff4d6] px-2.5 py-1.5 text-[9px] font-medium text-[#816b32]">Készülőben</span></div>
              <div className="mt-3 grid flex-1 grid-rows-3 gap-2 sm:mt-4 lg:grid-cols-3 lg:grid-rows-1 lg:gap-3">
                <div className="rounded-xl border border-border bg-[#fff4d6] p-2 lg:p-4"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className="text-xs font-semibold text-foreground lg:text-base">Bevásárlás</h3><span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-1 text-[8px] text-foreground"><UsersRound className="size-3" /> Családi</span></div><p className="mt-1 text-[10px] leading-relaxed text-foreground lg:mt-3 lg:text-sm">Tej és kenyér<br />Mosogatószer<span className="hidden sm:inline"><br />Gyümölcs</span></p></div>
                <div className="rounded-xl border border-border bg-[#fce9dd] p-2 lg:p-4"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className="text-xs font-semibold text-foreground lg:text-base">Hétvégi program</h3><span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-1 text-[8px] text-foreground"><UsersRound className="size-3" /> Családi</span></div><p className="mt-1 text-[10px] leading-relaxed text-foreground lg:mt-3 lg:text-sm">Szombaton közös ebéd, utána séta.</p></div>
                <div className="rounded-xl border border-border bg-[#edf0dc] p-2 lg:p-4"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className="text-xs font-semibold text-foreground lg:text-base">Ötletek</h3><span className="flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-1 text-[8px] text-foreground"><LockKeyhole className="size-3" /> Privát</span></div><p className="mt-1 text-[10px] leading-relaxed text-foreground lg:mt-3 lg:text-sm">Erkély rendbetétele<br />Új polc a dolgozószobába</p></div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[9px] text-muted-foreground"><ShoppingBasket className="size-3" /> Közös és saját jegyzetek, egy helyen.</p>
            </div>
          </article>

          <div className={styles.brandCard}>
            <span className="flex size-12 items-center justify-center rounded-2xl bg-card text-primary shadow-sm sm:size-16"><House className="size-6 sm:size-8" /></span>
            <p className="mt-3 text-[10px] font-medium tracking-[0.2em] text-[#596242] sm:mt-5 sm:text-xs">HOMEBASE</p>
            <h2 className="mt-1 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">Jó itthon.</h2>
            <p className="mt-2 text-xs text-muted-foreground sm:mt-3 sm:text-base">Minden, ami közös.</p>
          </div>
        </div>

        <div className="flex min-h-12 items-center justify-between gap-3 pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden="true"><span className={`${styles.progress} h-1 w-12 overflow-hidden rounded-full bg-border`}><span className="block h-full w-full origin-left rounded-full bg-primary" /></span>Rövid bemutató</div>
          <Button type="button" variant="outline" size="sm" className="h-11 motion-reduce:hidden" aria-label={isPaused ? 'Bemutató folytatása' : 'Bemutató szüneteltetése'} aria-pressed={isPaused} onClick={() => setIsPaused((paused) => !paused)}>
            {isPaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}{isPaused ? 'Folytatás' : 'Szünet'}
          </Button>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Bemutató fiktív adatokkal · A jegyzetek készülőben.
        <span className="sr-only"> A számlák összege 44 000 forint, ennek fele 22 000 forint. A bemutató térbeli nézetekkel mutatja az áttekintést, a számlákat és a jegyzeteket, végül a Homebase „Jó itthon.” köszöntésével zárul.</span>
      </figcaption>
    </figure>
  )
}

export default LandingPromo
