"use server";

import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { globalSearchQuerySchema, globalSearchResponseSchema } from "../zod/schema";
import { searchHomebase } from "./queries";

export const searchHomebaseAction = async (query: string) => {
  const parsedQuery = globalSearchQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return createErrorReturn({ type: "search-validation-error", message: parsedQuery.error.issues[0]?.message ?? "Adj meg legalább két karaktert a kereséshez." });
  }

  try {
    const result = await searchHomebase(parsedQuery.data);
    return createSuccessReturn(globalSearchResponseSchema.parse(result));
  } catch {
    return createErrorReturn({ type: "search-unavailable", message: "A keresés most nem érhető el. Próbáld újra." });
  }
};
