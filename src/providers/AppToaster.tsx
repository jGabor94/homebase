"use client";
import type { FC } from "react";
import { Toaster } from "react-hot-toast";
const AppToaster: FC = () => {

  return <Toaster position="bottom-center" containerClassName="!bottom-[calc(88px+env(safe-area-inset-bottom))] lg:!bottom-6" toastOptions={{ duration: 4500, style: { background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: "14px" } }} />;
};
export default AppToaster;
