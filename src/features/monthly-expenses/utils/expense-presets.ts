import type { AdditionalItemInput, ExpensePresetDto } from "../types";

export const createAdditionalItemFromPreset = (preset: ExpensePresetDto | null, id: string, isDefault = preset?.isDefault ?? false): AdditionalItemInput => ({
  id,
  presetId: preset?.id,
  name: preset?.name ?? "",
  amountMinor: preset?.amountMinor ?? null,
  isDefault,
});

export const createDefaultAdditionalItems = (presets: ExpensePresetDto[], makeId: () => string): AdditionalItemInput[] =>
  presets.filter((preset) => preset.isDefault).slice(0, 100).map((preset) => createAdditionalItemFromPreset(preset, makeId(), true));
