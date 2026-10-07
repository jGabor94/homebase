const CURRENCY_SUFFIX = /\s*(?:HUF|EUR|USD|GBP|CHF|CZK|PLN|RON|SEK|NOK|DKK|HRK|UAH|JPY|CAD|AUD|BGN|RSD|BAM|Ft\.?|forint(?:ok|ot)?)\s*$/iu;

export const parseHungarianAmountToMinor = (input: string) => {
  let value = input.trim().replace(/^−/u, "-").replace(/\u00a0|\u202f/g, " ").replace(CURRENCY_SUFFIX, "").trim();
  if (!value || value.length > 80) return null;

  const sign = value.startsWith("-") ? -1 : 1;
  value = value.replace(/^[+-]/, "").replace(/\s/g, "");
  if (!value || !/^[\d.,]+$/.test(value)) return null;

  const separators = [...value.matchAll(/[.,]/g)].map((match) => ({ character: match[0], index: match.index ?? -1 }));
  let integerPart = value;
  let fractionPart = "";

  if (separators.length) {
    const finalSeparator = separators.at(-1)!;
    const trailingDigits = value.length - finalSeparator.index - 1;
    const separatorKinds = new Set(separators.map(({ character }) => character));

    if (trailingDigits > 0 && trailingDigits <= 2) {
      fractionPart = value.slice(finalSeparator.index + 1);
      integerPart = value.slice(0, finalSeparator.index);
      if (separatorKinds.size > 1) {
        const decimalSeparator = finalSeparator.character;
        const groupingSeparator = decimalSeparator === "." ? "," : ".";
        if (integerPart.includes(decimalSeparator)) return null;
        if (integerPart.includes(groupingSeparator)
          && !new RegExp(`^\\d{1,3}(?:\\${groupingSeparator}\\d{3})+$`).test(integerPart)) return null;
        integerPart = integerPart.replace(/[.,]/g, "");
      } else {
        const separator = finalSeparator.character;
        const earlierSeparators = [...integerPart].filter((character) => character === separator).length;
        if (earlierSeparators > 0) {
          return null;
        }
      }
    } else {
      if (trailingDigits !== 3 || separatorKinds.size > 1 || !/^\d{1,3}(?:[.,]\d{3})+$/.test(value)) return null;
      integerPart = value.replace(/[.,]/g, "");
    }
  }

  if (!/^\d+$/.test(integerPart)) return null;
  const minor = Number(integerPart) * 100 + Number(fractionPart.padEnd(2, "0") || 0);
  if (!Number.isSafeInteger(minor)) return null;
  return sign * minor;
};

export const formatMinorAsHuf = (amountMinor: number | null) => {
  if (amountMinor === null) return "";
  const sign = amountMinor < 0 ? "−" : "";
  const absolute = Math.abs(amountMinor);
  const whole = Math.floor(absolute / 100).toLocaleString("hu-HU");
  const fraction = absolute % 100;
  return `${sign}${whole}${fraction ? `,${String(fraction).padStart(2, "0")}` : ""}`;
};

export const splitMinorAmount = (amountMinor: number) => {
  if (!Number.isSafeInteger(amountMinor)) throw new RangeError("Az összeg fillérben, egész számmal adható meg.");
  const firstMinor = Math.floor(amountMinor / 2);
  return { firstMinor, secondMinor: amountMinor - firstMinor };
};
