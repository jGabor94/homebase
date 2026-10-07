"use server";

import { count, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { Dal } from "@/lib/dal";
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types";
import { expensePresetsTable } from "../drizzle/schema";
import { getExpensePresets } from "./queries";
import type { ExpensePresetActionResult, ExpensePresetDto, ExpensePresetFormInput, UpdateExpensePresetInput } from "../types";
import { expensePresetDtoSchema, expensePresetFormSchema, expensePresetIdSchema, updateExpensePresetSchema } from "../zod/schema";

const safeStorageFailure = (message = "A közös tételek most nem menthetők. Próbáld újra.") => createErrorReturn({ type: "preset-storage-error", message });

const createExpensePresetDal = Dal.create({ cache: false })
  .$Input<[ExpensePresetFormInput]>()
  .schema({ input: z.tuple([expensePresetFormSchema]), output: expensePresetDtoSchema })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    const [preset] = input;
    const amountMinor = preset.amountMinor;
    if (amountMinor === null) return createErrorReturn({ type: "validation-error", message: "Add meg a tétel összegét." });
    try {
      const result = await db.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(752301, 1)`);
        const [currentCount] = await transaction.select({ value: count() }).from(expensePresetsTable);
        if (currentCount.value >= 100) return { kind: "limit" as const };
        const [created] = await transaction.insert(expensePresetsTable).values({
          id: crypto.randomUUID(),
          name: preset.name.trim(),
          amountMinor,
          isDefault: preset.isDefault,
        }).returning({ id: expensePresetsTable.id, name: expensePresetsTable.name, amountMinor: expensePresetsTable.amountMinor, isDefault: expensePresetsTable.isDefault });
        return created ? { kind: "created" as const, preset: created } : { kind: "failed" as const };
      });
      if (result.kind === "limit") return createErrorReturn({ type: "preset-limit", message: "Legfeljebb 100 közös tételsablon lehet." });
      if (result.kind !== "created") return safeStorageFailure();
      return createSuccessReturn(result.preset satisfies ExpensePresetDto);
    } catch {
      return safeStorageFailure();
    }
  });

const updateExpensePresetDal = Dal.create({ cache: false })
  .$Input<[UpdateExpensePresetInput]>()
  .schema({ input: z.tuple([updateExpensePresetSchema]), output: expensePresetDtoSchema })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    const [preset] = input;
    if (preset.amountMinor === null) return createErrorReturn({ type: "validation-error", message: "Add meg a tétel összegét." });
    try {
      const [updated] = await db.update(expensePresetsTable).set({
        name: preset.name.trim(),
        amountMinor: preset.amountMinor,
        isDefault: preset.isDefault,
        updatedAt: new Date(),
      }).where(eq(expensePresetsTable.id, preset.id)).returning({
        id: expensePresetsTable.id,
        name: expensePresetsTable.name,
        amountMinor: expensePresetsTable.amountMinor,
        isDefault: expensePresetsTable.isDefault,
      });
      if (!updated) return createErrorReturn({ type: "preset-not-found", message: "Ez a közös tételsablon már nem található." });
      return createSuccessReturn(updated satisfies ExpensePresetDto);
    } catch {
      return safeStorageFailure();
    }
  });

const deleteExpensePresetDal = Dal.create({ cache: false })
  .$Input<[string]>()
  .schema({ input: z.tuple([expensePresetIdSchema]), output: z.object({ id: expensePresetIdSchema }) })
  .authenticate()
  .authorize({ resource: "monthlyExpenses", action: "read" })
  .operation(async ({ input }) => {
    try {
      const [deleted] = await db.delete(expensePresetsTable).where(eq(expensePresetsTable.id, input[0])).returning({ id: expensePresetsTable.id });
      if (!deleted) return createErrorReturn({ type: "preset-not-found", message: "Ez a közös tételsablon már nem található." });
      return createSuccessReturn(deleted);
    } catch {
      return safeStorageFailure("A közös tétel most nem törölhető. Próbáld újra.");
    }
  });

const publicMessages: Record<string, { type: string; message: string }> = {
  unauthenticated: { type: "unauthenticated", message: "Jelentkezz be a közös tételek kezeléséhez." },
  unauthorized: { type: "unauthorized", message: "Ehhez a funkcióhoz nincs hozzáférésed." },
  "preset-limit": { type: "preset-limit", message: "Legfeljebb 100 közös tételsablon lehet." },
  "preset-not-found": { type: "preset-not-found", message: "Ez a közös tételsablon már nem található. Frissítsd az oldalt." },
  "zod-input-error": { type: "validation-error", message: "Ellenőrizd a tétel nevét és összegét." },
  "validation-error": { type: "validation-error", message: "Ellenőrizd a tétel nevét és összegét." },
};

const safeActionResult = <T,>(result: unknown, fallbackMessage = "A közös tételek most nem menthetők. Próbáld újra."): ExpensePresetActionResult<T> => {
  if (result && typeof result === "object" && "success" in result && result.success === true && "data" in result) {
    return { success: true, data: result.data as T };
  }
  if (result && typeof result === "object" && "success" in result && result.success === false && "error" in result) {
    const error = result.error;
    if (error && typeof error === "object" && "type" in error && typeof error.type === "string") {
      if (error.type === "preset-storage-error") return { success: false, error: { type: "preset-storage-error", message: fallbackMessage } };
      if (publicMessages[error.type]) return { success: false, error: publicMessages[error.type] };
    }
  }
  return { success: false, error: { type: "preset-storage-error", message: fallbackMessage } };
};

const revalidatePresetPages = () => {
  try {
    revalidatePath("/settings");
    revalidatePath("/monthly-expenses");
  } catch {
    // The routes read from the database on navigation even if cache invalidation is unavailable.
  }
};

export async function loadExpensePresets(): Promise<ExpensePresetActionResult<ExpensePresetDto[]>> {
  try {
    return safeActionResult(await getExpensePresets(), "A közös tételek most nem tölthetők be. Próbáld újra.");
  } catch {
    return { success: false, error: { type: "preset-storage-error", message: "A közös tételek most nem tölthetők be. Próbáld újra." } };
  }
}

export async function createExpensePreset(input: ExpensePresetFormInput): Promise<ExpensePresetActionResult<ExpensePresetDto>> {
  try {
    const result = safeActionResult<ExpensePresetDto>(await createExpensePresetDal(input));
    if (result.success) revalidatePresetPages();
    return result;
  } catch {
    return { success: false, error: { type: "preset-storage-error", message: "A közös tétel most nem menthető. Próbáld újra." } };
  }
}

export async function updateExpensePreset(input: UpdateExpensePresetInput): Promise<ExpensePresetActionResult<ExpensePresetDto>> {
  try {
    const result = safeActionResult<ExpensePresetDto>(await updateExpensePresetDal(input));
    if (result.success) revalidatePresetPages();
    return result;
  } catch {
    return { success: false, error: { type: "preset-storage-error", message: "A közös tétel most nem menthető. Próbáld újra." } };
  }
}

export async function deleteExpensePreset(id: string): Promise<ExpensePresetActionResult<{ id: string }>> {
  try {
    const result = safeActionResult<{ id: string }>(await deleteExpensePresetDal(id), "A közös tétel most nem törölhető. Próbáld újra.");
    if (result.success) revalidatePresetPages();
    return result;
  } catch {
    return { success: false, error: { type: "preset-storage-error", message: "A közös tétel most nem törölhető. Próbáld újra." } };
  }
}
