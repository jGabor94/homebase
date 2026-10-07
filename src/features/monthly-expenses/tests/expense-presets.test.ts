import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createAdditionalItemFromPreset, createDefaultAdditionalItems } from "../utils/expense-presets";
import { summarizeInvoices } from "../utils";
import { expensePresetDtoSchema, expensePresetFormSchema } from "../zod/schema";

test("preset schema trims names and accepts only bounded nonnegative whole-fillér amounts", () => {
  assert.deepEqual(expensePresetFormSchema.parse({ name: " Gáz átalány ", amountMinor: 1_400_000, isDefault: false }), {
    name: "Gáz átalány",
    amountMinor: 1_400_000,
    isDefault: false,
  });
  assert.equal(expensePresetFormSchema.parse({ name: "Gáz", amountMinor: 0, isDefault: true }).isDefault, true);
  for (const amountMinor of [null, -1, 1.5, 9_000_000_000_001]) {
    assert.equal(expensePresetFormSchema.safeParse({ name: "Gáz", amountMinor, isDefault: false }).success, false);
  }
  assert.equal(expensePresetFormSchema.safeParse({ name: "  ", amountMinor: 0, isDefault: false }).success, false);
  assert.equal(expensePresetFormSchema.safeParse({ name: "x".repeat(121), amountMinor: 0, isDefault: false }).success, false);
  assert.equal(expensePresetDtoSchema.safeParse({ id: "not-a-uuid", name: "Gáz", amountMinor: 0, isDefault: false }).success, false);
  assert.equal(expensePresetDtoSchema.safeParse({ id: randomUUID(), name: "Gáz", amountMinor: 0 }).success, false);
});

test("adding a preset copies a snapshot with its own id and later edits do not flow into it", () => {
  const preset = { id: randomUUID(), name: "Gáz átalány", amountMinor: 1_400_000, isDefault: true };
  const first = createAdditionalItemFromPreset(preset, randomUUID());
  const second = createAdditionalItemFromPreset(preset, randomUUID());
  preset.name = "Módosított gáz";
  preset.amountMinor = 1_500_000;

  assert.notEqual(first.id, second.id);
  assert.equal(first.name, "Gáz átalány");
  assert.equal(first.amountMinor, 1_400_000);
  assert.equal(first.isDefault, true);
  const custom = createAdditionalItemFromPreset(null, randomUUID());
  assert.match(custom.id, /^[0-9a-f-]{36}$/i);
  assert.equal(custom.name, "");
  assert.equal(custom.amountMinor, null);
  assert.equal(custom.isDefault, false);
});

test("only default presets become new-report snapshots, with a fresh id per row", () => {
  const defaults = [
    { id: randomUUID(), name: "Átalány A", amountMinor: 140_000, isDefault: true },
    { id: randomUUID(), name: "Átalány B", amountMinor: 220_000, isDefault: false },
    { id: randomUUID(), name: "Átalány C", amountMinor: 310_000, isDefault: true },
  ];
  let nextId = 0;
  const rows = createDefaultAdditionalItems(defaults, () => `generated-${++nextId}`);
  assert.deepEqual(rows.map(({ name, amountMinor, isDefault }) => ({ name, amountMinor, isDefault })), [
    { name: "Átalány A", amountMinor: 140_000, isDefault: true },
    { name: "Átalány C", amountMinor: 310_000, isDefault: true },
  ]);
  assert.equal(new Set(rows.map((row) => row.id)).size, 2);
  assert.equal(createDefaultAdditionalItems(defaults, () => "none").length, 2);
  assert.equal(summarizeInvoices([], 0, rows).totalMinor, 450_000);
});
