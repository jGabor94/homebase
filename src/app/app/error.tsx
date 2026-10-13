"use client";
import type { FC } from "react";
import { Button } from "@/components/ui/button";
interface Props { reset: () => void }
const AppError: FC<Props> = ({ reset }) => {

  return <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 p-8 text-center"><h1 className="text-3xl font-bold tracking-tight">Most nem sikerült betölteni.</h1><p className="text-muted-foreground">Próbáld újra. A mentett adataid megmaradtak.</p><Button onClick={reset}>Újrapróbálás</Button></main>;
};
export default AppError;
