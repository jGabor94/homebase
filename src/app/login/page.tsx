import type { FC } from "react";
import Link from "next/link";
import { House } from "lucide-react";
import { auth, signIn } from "@/features/authentication/lib/auth";
import { redirect } from "next/navigation";

const Login: FC = async () => {
  const session = await auth();
  if (session?.user) redirect("/monthly-expenses");
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <Link href="/" className="flex min-h-11 items-center gap-2 text-2xl font-semibold">
        <House aria-hidden className="size-7 text-primary" /> homebase
      </Link>
      <section className="rounded-2xl border border-border bg-card p-7 shadow-sm">
        <h1 className="font-serif text-4xl">Jó, hogy itt vagy.</h1>
        <p className="mt-3 text-muted-foreground">A családi kiadásokhoz jelentkezz be a saját Google-fiókoddal.</p>
        {configured ? (
          <form action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/monthly-expenses" });
          }}>
            <button className="mt-6 min-h-12 w-full rounded-xl bg-primary px-5 text-primary-foreground hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
              Bejelentkezés Google-fiókkal
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-xl bg-muted p-4 text-sm">A Google-bejelentkezés még nincs beállítva. Az alkalmazás gazdájának meg kell adnia a Google OAuth hozzáférést.</p>
        )}
      </section>
    </main>
  );
};

export default Login;
