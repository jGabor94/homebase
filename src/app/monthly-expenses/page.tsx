import type { FC } from "react";
import { redirect } from "next/navigation";

const MonthlyExpensesRedirect: FC = () => {

  redirect("/app/monthly-expenses");
};

export default MonthlyExpensesRedirect;
