import type { FC } from "react";
import Link from "next/link";
import Image from "next/image";
import Brand from "@/components/Brand";
import { auth, signIn } from "@/features/authentication/lib/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

const getLoginErrorMessage = (error?: string) => {
  if (!error) return null;

  switch (error) {
    case "OAuthSignin":
    case "OAuthCallback":
    case "OAuthCreateAccount":
    case "Callback":
      return "A Google-bejelentkezés nem sikerült. Próbáld meg újra.";
    case "OAuthAccountNotLinked":
      return "Ez a Google-fiók nem kapcsolható ehhez a felhasználói fiókhoz. Próbáld a megfelelő Google-fiókkal.";
    case "AccessDenied":
      return "A Google-bejelentkezést megszakítottad vagy elutasítottad.";
    case "Configuration":
      return "A Google-bejelentkezés beállítása hiányos. Szólj az alkalmazás gazdájának.";
    default:
      return "A bejelentkezés megszakadt vagy hibába ütközött. Próbáld meg újra.";
  }
};

type LoginProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

const Login: FC<LoginProps> = async ({ searchParams }) => {
  const { error: errorParam } = await searchParams;
  const error = Array.isArray(errorParam) ? errorParam[0] : errorParam;
  const session = await auth();
  if (session?.user) redirect("/app");
  const configured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const loginError = getLoginErrorMessage(error);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <Link href="/" className="mx-auto flex min-h-11 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"><Brand /></Link>
      <Image src="/images/homebase/home-wide.webp" alt="" width={1800} height={600} sizes="450px" className="-mb-8 h-auto w-full" />
      <section className="relative rounded-[24px] border bg-card p-7 shadow-[0_12px_40px_rgba(16,37,45,0.06)]">
        <h1 className="text-4xl font-bold tracking-tight">Jó, hogy itt vagy.</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">A család közös teréhez jelentkezz be a saját Google-fiókoddal.</p>
        {loginError ? (
          <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {loginError}
          </p>
        ) : null}
        {configured ? (
          <form action={async () => {
            "use server";
            try {
              await signIn("google", { redirectTo: "/app" });
            } catch (error) {
              if (error instanceof AuthError) {
                redirect(`/login?error=${encodeURIComponent(error.type)}`);
              }
              throw error;
            }
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
