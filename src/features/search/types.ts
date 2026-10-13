import { z } from "zod";
import { globalSearchItemSchema, globalSearchQuerySchema, globalSearchResponseSchema } from "./zod/schema";

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
export type GlobalSearchItem = z.infer<typeof globalSearchItemSchema>;
export type GlobalSearchResponse = z.infer<typeof globalSearchResponseSchema>;
