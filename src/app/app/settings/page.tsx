import type { FC } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import PresetSettingsForm from "@/features/monthly-expenses/components/PresetSettingsForm";
import { getExpensePresets } from "@/features/monthly-expenses/dal/queries";

export const metadata: Metadata = {
  title: "Beállítások · homebase",
};

const SettingsPage: FC = async () => {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasPermission(session.user, "monthlyExpenses", "read")) redirect("/app");

  const presetsResult = await getExpensePresets();
  const initialPresets = presetsResult.success ? presetsResult.data : [];
  const initialError = presetsResult.success ? null : presetsResult.error.message;

  return (
    <>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 pb-10 pt-7 sm:px-8 sm:pt-8 lg:px-10">
        <section className="mb-6">
          <h1 className="font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-foreground">Beállítások</h1>
          <p className="mt-1 max-w-2xl text-base leading-6 text-muted-foreground">Közösen használt havi tételsablonok.</p>
        </section>
        <PresetSettingsForm initialPresets={initialPresets} initialError={initialError} />
      </main>
    </>
  );
};

export default SettingsPage;
