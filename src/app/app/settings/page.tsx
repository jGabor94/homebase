import type { FC } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/authentication/lib/auth";
import { hasPermission } from "@/features/authorization/utils";
import PresetSettingsForm from "@/features/monthly-expenses/components/PresetSettingsForm";
import { getExpensePresets } from "@/features/monthly-expenses/dal/queries";
import AppPageHeader from "@/components/AppPageHeader";

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
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10">
        <AppPageHeader title="Beállítások" description="Közösen használt havi tételsablonok." illustration="notes" />
        <PresetSettingsForm initialPresets={initialPresets} initialError={initialError} />
      </main>
    </>
  );
};

export default SettingsPage;
