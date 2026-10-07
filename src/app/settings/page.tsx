import type { FC } from "react";
import { redirect } from "next/navigation";

const SettingsRedirect: FC = () => {

  redirect("/app/settings");
};

export default SettingsRedirect;
