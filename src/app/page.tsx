import type { FC } from "react";
import Link from "next/link";
import { ArrowRight, House, NotebookPen, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingPromo from "@/features/landing/components/LandingPromo";

const LandingPage: FC = () => {

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-8 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex min-h-11 items-center gap-3 text-2xl font-semibold tracking-tight">
          <House aria-hidden="true" className="size-8 text-primary" /> homebase
        </Link>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/app">Az alkalmazás megnyitása <ArrowRight aria-hidden="true" data-icon="inline-end" /></Link>
        </Button>
      </header>
      <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
        <p className="mb-4 text-sm font-medium tracking-wide text-primary">A család közös tere</p>
        <h1 className="max-w-2xl font-serif text-6xl font-semibold leading-tight tracking-tight sm:text-7xl">Jó itthon.</h1>
        <p className="mt-5 max-w-xl text-xl leading-relaxed text-muted-foreground">Számlák, tervek és minden, ami közös. Egy nyugodt hely a család mindennapi dolgaihoz.</p>
        <Button asChild size="lg" className="mt-8 min-h-12 w-fit rounded-xl">
          <Link href="/login">Bejelentkezés Google-fiókkal <ArrowRight aria-hidden="true" data-icon="inline-end" /></Link>
        </Button>
        <div className="mt-12">
          <LandingPromo />
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          <article className="rounded-2xl border bg-card p-6">
            <ReceiptText aria-hidden="true" className="mb-4 size-7 text-primary" />
            <h2 className="font-serif text-2xl font-semibold">Közös kiadások</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">Havi közműszámlák beolvasása és átlátható összesítése, egy helyen.</p>
          </article>
          <article className="rounded-2xl border bg-note-sage p-6">
            <NotebookPen aria-hidden="true" className="mb-4 size-7 text-primary" />
            <h2 className="font-serif text-2xl font-semibold">A hűtőajtón</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">A közös és személyes jegyzetek otthona készülőben van. Az alkalmazásban már megnézheted a bemutatóját.</p>
          </article>
        </div>
      </section>
      <footer className="text-sm text-muted-foreground">homebase · A család saját használatára.</footer>
    </main>
  );
};

export default LandingPage;
