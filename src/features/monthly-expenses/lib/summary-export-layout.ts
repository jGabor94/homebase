import type { SummaryExportSnapshot } from "../types";

export const SUMMARY_LAYOUT = {
  width: 360,
  height: 640,
  margin: 20,
  colors: {
    cream: "#f5f8f9",
    paper: "#ffffff",
    terracotta: "#126574",
    brown: "#0b1628",
    sage: "#eaf5ef",
    muted: "#586b85",
    line: "#e3e9ee",
    warning: "#fff4df",
  },
} as const;

export type SummaryLayoutOperation =
  | { type: "rect"; x: number; y: number; width: number; height: number; fill: string; stroke?: string; radius?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; color: string; width: number }
  | { type: "text"; x: number; y: number; value: string; color: string; size: number; bold?: boolean; align?: "left" | "right" };

export interface SummaryLayoutPage {
  operations: SummaryLayoutOperation[];
  contentHeight: number;
}

export type TextMeasure = (value: string, size: number, bold: boolean) => number;

const margin = SUMMARY_LAYOUT.margin;
const contentWidth = SUMMARY_LAYOUT.width - margin * 2;
const contentBottom = SUMMARY_LAYOUT.height - 48;
const sectionLabels = { invoices: "Számlák", additional: "Számla nélküli tételek" };

const wrapText = (value: string, maxWidth: number, fontSize: number, measureText: TextMeasure, bold = false) => {
  const words = value.split(/\s+/u);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, fontSize, bold) > maxWidth) {
      lines.push(current);
      current = "";
    }
    if (measureText(word, fontSize, bold) > maxWidth) {
      for (const character of Array.from(word)) {
        if (current && measureText(current + character, fontSize, bold) > maxWidth) {
          lines.push(current);
          current = character;
        } else {
          current += character;
        }
      }
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

export const createSummaryExportLayout = (
  snapshot: SummaryExportSnapshot,
  measureText: TextMeasure,
  options: { compact?: boolean } = {},
): SummaryLayoutPage[] => {
  const contentLimit = options.compact ? Number.POSITIVE_INFINITY : contentBottom;
  const pages: SummaryLayoutPage[] = [];
  let operations: SummaryLayoutOperation[] = [];
  let y = 0;
  let activeSection: string | null = null;

  const startPage = (continued: boolean, repeatSection: string | null = null) => {
    operations = [{ type: "rect", x: 0, y: 0, width: SUMMARY_LAYOUT.width, height: SUMMARY_LAYOUT.height, fill: SUMMARY_LAYOUT.colors.cream }];
    operations.push({ type: "text", x: margin, y: 27, value: "HOMEBASE", color: SUMMARY_LAYOUT.colors.terracotta, size: 10, bold: true });
    const titleSize = continued ? 18 : 22;
    const titleLines = wrapText(continued ? "Kimutatás folytatása" : "Havi közös költségkimutatás", contentWidth, titleSize, measureText, true);
    titleLines.forEach((value, index) => operations.push({ type: "text", x: margin, y: 58 + index * 26, value, color: SUMMARY_LAYOUT.colors.brown, size: titleSize, bold: true }));
    const monthY = 58 + (titleLines.length - 1) * 26 + 23;
    operations.push({ type: "text", x: margin, y: monthY, value: snapshot.monthLabel, color: SUMMARY_LAYOUT.colors.muted, size: 12.5 });
    operations.push({ type: "line", x1: margin, y1: monthY + 14, x2: SUMMARY_LAYOUT.width - margin, y2: monthY + 14, color: SUMMARY_LAYOUT.colors.line, width: 1 });
    y = monthY + 29;
    pages.push({ operations, contentHeight: SUMMARY_LAYOUT.height });
    if (continued && repeatSection) addSectionHeading(repeatSection);
  };

  const addSectionHeading = (label: string) => {
    operations.push({ type: "rect", x: margin, y, width: contentWidth, height: 31, fill: SUMMARY_LAYOUT.colors.sage, radius: 8 });
    operations.push({ type: "text", x: margin + 12, y: y + 20, value: label, color: SUMMARY_LAYOUT.colors.brown, size: 12, bold: true });
    y += 37;
  };

  const ensureSpace = (height: number, repeatSection: string | null = activeSection) => {
    if (y + height <= contentLimit) return;
    startPage(true, repeatSection);
  };

  const addRows = (sectionLabel: string, rows: Array<{ label: string; amount: string; details?: string[] }>) => {
    activeSection = sectionLabel;
    if (y + 100 > contentLimit) startPage(true);
    addSectionHeading(sectionLabel);
    const rowWidth = contentWidth - 24;
    for (const row of rows) {
      const boldLabel = row.details !== undefined;
      const amountWidth = row.amount ? Math.min(measureText(row.amount, 16, true), rowWidth * 0.45) : 0;
      const labelWidth = rowWidth - (amountWidth ? amountWidth + 12 : 0);
      const labelLines = wrapText(row.label, labelWidth, 12.5, measureText, boldLabel);
      const detailLines = (row.details ?? []).flatMap((detail) => wrapText(detail, rowWidth, 10.5, measureText));
      const amountLines = row.amount ? wrapText(row.amount, amountWidth, 16, measureText, true) : [];
      const detailTop = 18 + Math.max(labelLines.length * 17, amountLines.length * 20);
      const rowHeight = detailTop + detailLines.length * 14 + 6;
      ensureSpace(rowHeight + 6, sectionLabel);
      operations.push({ type: "rect", x: margin, y, width: contentWidth, height: rowHeight, fill: SUMMARY_LAYOUT.colors.paper, stroke: SUMMARY_LAYOUT.colors.line, radius: 8 });
      labelLines.forEach((line, index) => operations.push({
        type: "text", x: margin + 12, y: y + 18 + index * 17, value: line,
        color: SUMMARY_LAYOUT.colors.brown, size: 12.5, bold: boldLabel,
      }));
      detailLines.forEach((line, index) => operations.push({
        type: "text", x: margin + 12, y: y + detailTop + index * 14, value: line,
        color: SUMMARY_LAYOUT.colors.muted, size: 10.5,
      }));
      amountLines.forEach((line, index) => operations.push({
        type: "text", x: SUMMARY_LAYOUT.width - margin - 12, y: y + 18 + index * 20, value: line,
        color: SUMMARY_LAYOUT.colors.brown, size: 16, bold: true, align: "right",
      }));
      y += rowHeight + 6;
    }
    y += 8;
    activeSection = null;
  };

  startPage(false);
  const invoiceRows = snapshot.invoiceRows.length
    ? snapshot.invoiceRows.map((row) => ({ label: `${row.category} · ${row.provider}`, amount: row.amount, details: row.details }))
    : [{ label: "Nincs számlasor.", amount: "" }];
  const additionalRows = snapshot.additionalRows.length
    ? snapshot.additionalRows.map((row) => ({ label: row.name, amount: row.amount }))
    : [{ label: "Nincs számla nélküli tétel.", amount: "" }];
  addRows(sectionLabels.invoices, invoiceRows);
  addRows(sectionLabels.additional, additionalRows);

  for (const warning of snapshot.warnings) {
    const lines = wrapText(warning, contentWidth - 24, 12, measureText);
    const height = lines.length * 17 + 20;
    ensureSpace(height + 8);
    operations.push({ type: "rect", x: margin, y, width: contentWidth, height, fill: SUMMARY_LAYOUT.colors.warning, radius: 5 });
    lines.forEach((line, index) => operations.push({ type: "text", x: margin + 12, y: y + 22 + index * 17, value: line, color: SUMMARY_LAYOUT.colors.brown, size: 12 }));
    y += height + 8;
  }

  activeSection = null;
  const totalLines = wrapText(snapshot.total, contentWidth - 24, 21, measureText, true);
  const halfLines = wrapText(snapshot.half, contentWidth - 24, 21, measureText, true);
  const totalHeight = 36 + totalLines.length * 25;
  const halfHeight = 36 + halfLines.length * 25;
  ensureSpace(totalHeight + halfHeight + 14, null);
  const addTotalCard = (label: string, lines: string[], height: number, emphasized: boolean) => {
    const color = emphasized ? SUMMARY_LAYOUT.colors.paper : SUMMARY_LAYOUT.colors.brown;
    operations.push({ type: "rect", x: margin, y, width: contentWidth, height, fill: emphasized ? SUMMARY_LAYOUT.colors.terracotta : SUMMARY_LAYOUT.colors.paper, stroke: emphasized ? undefined : SUMMARY_LAYOUT.colors.line, radius: 8 });
    operations.push({ type: "text", x: margin + 12, y: y + 20, value: label, color, size: 12.5, bold: true });
    lines.forEach((value, index) => operations.push({ type: "text", x: SUMMARY_LAYOUT.width - margin - 12, y: y + 46 + index * 25, value, color, size: 21, bold: true, align: "right" }));
    y += height + 7;
  };
  addTotalCard("Összesen", totalLines, totalHeight, false);
  addTotalCard("Fele", halfLines, halfHeight, true);

  pages.forEach((page, index) => {
    page.contentHeight = options.compact ? y + 42 : SUMMARY_LAYOUT.height;
    const background = page.operations[0];
    if (background.type === "rect") background.height = page.contentHeight;
    const footerY = page.contentHeight - 34;
    page.operations.push({ type: "line", x1: margin, y1: footerY, x2: SUMMARY_LAYOUT.width - margin, y2: footerY, color: SUMMARY_LAYOUT.colors.line, width: 0.7 });
    page.operations.push({ type: "text", x: margin, y: page.contentHeight - 20, value: `Homebase · ${snapshot.monthLabel}`, color: SUMMARY_LAYOUT.colors.muted, size: 8 });
    page.operations.push({ type: "text", x: SUMMARY_LAYOUT.width - margin, y: page.contentHeight - 20, value: `${index + 1} / ${pages.length}`, color: SUMMARY_LAYOUT.colors.muted, size: 8, align: "right" });
  });
  return pages;
};

const fetchFontBase64 = async (path: string) => {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error("A PDF betűtípusai nem tölthetők be. Töltsd le a kimutatást PNG-ként vagy TXT-ként.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
};

export const loadSummaryFonts = async () => {
  const [regular, bold] = await Promise.all([
    fetchFontBase64("/fonts/LiberationSans-Regular.ttf"),
    fetchFontBase64("/fonts/LiberationSans-Bold.ttf"),
  ]);
  return { regular, bold };
};

export const renderSummaryLayoutPdf = async (snapshot: SummaryExportSnapshot) => {
  const [{ jsPDF }, fonts] = await Promise.all([import("jspdf"), loadSummaryFonts()]);
  const pageFormat: [number, number] = [SUMMARY_LAYOUT.width, SUMMARY_LAYOUT.height];
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: pageFormat, compress: true });
  pdf.addFileToVFS("LiberationSans-Regular.ttf", fonts.regular);
  pdf.addFont("LiberationSans-Regular.ttf", "LiberationSans", "normal", "Identity-H");
  pdf.addFileToVFS("LiberationSans-Bold.ttf", fonts.bold);
  pdf.addFont("LiberationSans-Bold.ttf", "LiberationSans", "bold", "Identity-H");
  pdf.setFont("LiberationSans", "normal");
  const measureText: TextMeasure = (value, size, bold) => {
    pdf.setFont("LiberationSans", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    return pdf.getTextWidth(value);
  };
  const compactPage = createSummaryExportLayout(snapshot, measureText, { compact: true })[0];
  const fitsSinglePage = compactPage.contentHeight <= 960;
  const pages = fitsSinglePage ? [compactPage] : createSummaryExportLayout(snapshot, measureText);
  if (fitsSinglePage) {
    pageFormat[1] = compactPage.contentHeight;
    pdf.addPage(pageFormat, "portrait");
    pdf.deletePage(1);
  }

  const hexRgb = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) pdf.addPage(pageFormat, "portrait");
    for (const operation of page.operations) {
      if (operation.type === "rect") {
        const [r, g, b] = hexRgb(operation.fill);
        pdf.setFillColor(r, g, b);
        if (operation.stroke) {
          const [sr, sg, sb] = hexRgb(operation.stroke);
          pdf.setDrawColor(sr, sg, sb);
          pdf.setLineWidth(0.5);
        }
        if (operation.radius) pdf.roundedRect(operation.x, operation.y, operation.width, operation.height, operation.radius, operation.radius, operation.stroke ? "FD" : "F");
        else pdf.rect(operation.x, operation.y, operation.width, operation.height, operation.stroke ? "FD" : "F");
      } else if (operation.type === "line") {
        const [r, g, b] = hexRgb(operation.color);
        pdf.setDrawColor(r, g, b);
        pdf.setLineWidth(operation.width);
        pdf.line(operation.x1, operation.y1, operation.x2, operation.y2);
      } else {
        const [r, g, b] = hexRgb(operation.color);
        pdf.setTextColor(r, g, b);
        pdf.setFont("LiberationSans", operation.bold ? "bold" : "normal");
        pdf.setFontSize(operation.size);
        pdf.text(operation.value, operation.x, operation.y, { align: operation.align ?? "left" });
      }
    }
  });
  return pdf.output("blob");
};

export const renderSummaryLayoutPng = async (snapshot: SummaryExportSnapshot) => {
  if (typeof FontFace === "function" && document.fonts) {
    const [regularFont, boldFont] = await Promise.all([
      new FontFace("LiberationSans", 'url("/fonts/LiberationSans-Regular.ttf")', { weight: "400" }).load(),
      new FontFace("LiberationSans", 'url("/fonts/LiberationSans-Bold.ttf")', { weight: "700" }).load(),
    ]);
    document.fonts.add(regularFont);
    document.fonts.add(boldFont);
  }
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) throw new Error("A kimutatás képe nem készíthető el ebben a böngészőben.");
  const measureText: TextMeasure = (value, size, bold) => {
    measureContext.font = `${bold ? "bold " : ""}${size}px LiberationSans`;
    return measureContext.measureText(value).width;
  };
  const pages = createSummaryExportLayout(snapshot, measureText, { compact: true });
  const scale = 3.6;
  const pageGap = 18;
  const logicalHeight = pages.reduce((total, page) => total + page.contentHeight, 0) + Math.max(0, pages.length - 1) * pageGap;
  const width = SUMMARY_LAYOUT.width * scale;
  const height = Math.ceil(logicalHeight * scale);
  if (height > 24_000 || width * height > 32_000_000) {
    throw new Error("A kimutatás túl hosszú egyetlen PNG-képhez. Válaszd a PDF-formátumot a teljes, többoldalas exporthoz.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A kimutatás képe nem készíthető el ebben a böngészőben.");
  context.setTransform(scale, 0, 0, scale, 0, 0);

  const hexRgb = (hex: string) => `rgb(${[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16)).join(",")})`;
  pages.forEach((page, pageIndex) => {
    const yOffset = pages.slice(0, pageIndex).reduce((total, previous) => total + previous.contentHeight + pageGap, 0);
    for (const operation of page.operations) {
      if (operation.type === "rect") {
        context.fillStyle = hexRgb(operation.fill);
        context.strokeStyle = operation.stroke ? hexRgb(operation.stroke) : "transparent";
        context.lineWidth = 0.5;
        context.beginPath();
        context.roundRect(operation.x, operation.y + yOffset, operation.width, operation.height, operation.radius ?? 0);
        context.fill();
        if (operation.stroke) context.stroke();
      } else if (operation.type === "line") {
        context.strokeStyle = hexRgb(operation.color);
        context.lineWidth = operation.width;
        context.beginPath();
        context.moveTo(operation.x1, operation.y1 + yOffset);
        context.lineTo(operation.x2, operation.y2 + yOffset);
        context.stroke();
      } else {
        context.fillStyle = hexRgb(operation.color);
        context.font = `${operation.bold ? "bold " : ""}${operation.size}px LiberationSans`;
        context.textAlign = operation.align ?? "left";
        context.fillText(operation.value, operation.x, operation.y + yOffset);
      }
    }
  });
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("A PNG-fájl nem készíthető el.")), "image/png"));
};
