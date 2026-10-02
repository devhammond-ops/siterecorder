import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import {
  HSQ_COMPANY,
  HSQ_HAZARD_ROWS,
  HSQ_PPE_ITEMS,
  HSQ_PROBABILITY_LABELS,
  HSQ_SBC,
  HSQ_SEVERITY_CONSEQUENCES,
  HSQ_SEVERITY_LABELS,
  riskBand,
} from "@/lib/hsq-constants";
import type {
  HsqDailyReport,
  HsqReportImage,
  HsqReportVisitor,
  HsqReportWorker,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 36;

interface ImageInput {
  bytes: Uint8Array;
}

export async function buildHsqPdf(
  report: HsqDailyReport,
  workers: HsqReportWorker[],
  visitors: HsqReportVisitor[],
  images: ImageInput[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - MARGIN;
    }
  };

  const text = (value: string, opts: { x?: number; size?: number; bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(value, {
      x: opts.x ?? MARGIN,
      y,
      size: opts.size ?? 9,
      font: opts.bold ? bold : font,
      color: opts.color,
    });
  };

  const line = () => {
    ensure(8);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4.w - MARGIN, y },
      thickness: 0.6,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 10;
  };

  text("Daily Hazard Risk Assessment", { size: 16, bold: true });
  y -= 22;
  text(`${HSQ_COMPANY}  |  ${formatDate(report.report_date)}  |  ${report.status}`, {
    size: 9,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 16;
  line();

  const headerRows: [string, string][] = [
    ["Company", HSQ_COMPANY],
    ["Date", formatDate(report.report_date)],
    ["Location", report.location],
    ["Description of Task", report.task_description],
    ["Prepared by", `${report.prepared_by_name} (${report.prepared_by_signature})`],
    [
      "Supervisor",
      report.supervisor_name
        ? `${report.supervisor_name} (${report.supervisor_signature ?? ""})`
        : "—",
    ],
  ];
  for (const [label, value] of headerRows) {
    ensure(14);
    text(`${label}: `, { bold: true, size: 8 });
    const lw = bold.widthOfTextAtSize(`${label}: `, 8);
    page.drawText(truncate(String(value ?? "—"), 90), {
      x: MARGIN + lw,
      y,
      size: 8,
      font,
    });
    y -= 12;
  }
  y -= 6;

  ensure(20);
  text("Task Hazard Assessment", { size: 12, bold: true });
  y -= 16;
  for (const row of HSQ_HAZARD_ROWS) {
    ensure(48);
    text(truncate(row.taskStep, 95), { bold: true, size: 8 });
    y -= 11;
    text(`Hazard: ${truncate(row.hazards, 90)}`, { size: 7, color: rgb(0.3, 0.3, 0.3) });
    y -= 10;
    text(
      `Initial: ${row.initialRisk}  |  Precautions: ${truncate(row.precautions, 70)}  |  Final: ${row.finalRisk}  |  Initials: ${report.prepared_by_signature}`,
      { size: 7 }
    );
    y -= 14;
  }

  ensure(20);
  text("Risk Rating Matrix (reference)", { size: 12, bold: true });
  y -= 14;
  text("Probability × Severity — Low 1–4 / Medium 5–9 / High 10–25", {
    size: 8,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 12;

  const cellW = 48;
  const startX = MARGIN + 90;
  ensure(20);
  HSQ_SEVERITY_LABELS.forEach((s, i) => {
    page.drawText(`${s.value}`, {
      x: startX + i * cellW + 16,
      y,
      size: 7,
      font: bold,
    });
  });
  y -= 12;
  for (const p of HSQ_PROBABILITY_LABELS) {
    ensure(16);
    page.drawText(`${p.value} ${p.label.slice(0, 8)}`, { x: MARGIN, y, size: 7, font });
    HSQ_SEVERITY_LABELS.forEach((s, i) => {
      const score = p.value * s.value;
      const band = riskBand(score);
      const fill =
        band === "high"
          ? rgb(0.85, 0.2, 0.2)
          : band === "medium"
            ? rgb(0.95, 0.8, 0.25)
            : rgb(0.2, 0.7, 0.4);
      page.drawRectangle({
        x: startX + i * cellW,
        y: y - 2,
        width: cellW - 4,
        height: 12,
        color: fill,
      });
      page.drawText(String(score), {
        x: startX + i * cellW + 16,
        y,
        size: 7,
        font: bold,
        color: rgb(1, 1, 1),
      });
    });
    y -= 14;
  }
  y -= 8;

  ensure(18);
  text("Workers Sign On", { size: 12, bold: true });
  y -= 14;
  if (workers.length === 0) {
    text("No workers recorded.", { size: 8, color: rgb(0.5, 0.5, 0.5) });
    y -= 12;
  } else {
    for (const w of workers) {
      ensure(12);
      text(`${w.worker_name} — ${w.worker_signature}`, { size: 8 });
      y -= 11;
    }
  }
  y -= 6;

  ensure(18);
  text("Visitor Sign On", { size: 12, bold: true });
  y -= 14;
  if (visitors.length === 0) {
    text("No visitors recorded.", { size: 8, color: rgb(0.5, 0.5, 0.5) });
    y -= 12;
  } else {
    for (const v of visitors) {
      ensure(12);
      text(
        `${v.visitor_name} — ${v.visitor_signature || "—"} — ${v.visit_time || "—"}`,
        { size: 8 }
      );
      y -= 11;
    }
  }
  y -= 8;

  ensure(18);
  text("Subcontractor PPE Inspection Checklist", { size: 12, bold: true });
  y -= 12;
  text(`Project: ${report.task_description}  |  SBC: ${HSQ_SBC}  |  Location: ${report.location}`, {
    size: 7,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 14;

  const checklist = (report.ppe_checklist ?? {}) as Record<
    string,
    { result?: string; remarks?: string[] }
  >;
  let lastGroup = "";
  for (const item of HSQ_PPE_ITEMS) {
    ensure(12);
    if (item.group !== lastGroup) {
      text(item.group, { bold: true, size: 8 });
      y -= 11;
      lastGroup = item.group;
    }
    const answer = checklist[item.id];
    const result = answer?.result || "—";
    const remarks =
      answer?.remarks && answer.remarks.length > 0 ? ` (${answer.remarks.join(", ")})` : "";
    text(`  ${truncate(item.description, 70)} — ${result}${remarks}`, { size: 7 });
    y -= 10;
  }
  y -= 8;

  ensure(18);
  text(`Safety Pictures (${images.length})`, { size: 12, bold: true });
  y -= 14;
  if (images.length === 0) {
    text("No safety pictures.", { size: 8, color: rgb(0.5, 0.5, 0.5) });
  } else {
    const embedded: { image: PDFImage; w: number; h: number }[] = [];
    for (const img of images) {
      const e = await embedImage(doc, img.bytes);
      if (e) embedded.push(e);
    }
    const cols = 3;
    const gap = 8;
    const cellW = (A4.w - MARGIN * 2 - gap * (cols - 1)) / cols;
    const cellH = 110;
    for (let i = 0; i < embedded.length; i++) {
      const col = i % cols;
      if (col === 0) {
        ensure(cellH + gap);
        y -= cellH;
      }
      const x = MARGIN + col * (cellW + gap);
      const t = embedded[i];
      const dims = fit(t.w, t.h, cellW - 4, cellH - 4);
      page.drawRectangle({
        x,
        y,
        width: cellW,
        height: cellH,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.5,
      });
      page.drawImage(t.image, {
        x: x + (cellW - dims.w) / 2,
        y: y + (cellH - dims.h) / 2,
        width: dims.w,
        height: dims.h,
      });
      if (col === cols - 1) y -= gap;
    }
  }

  return doc.save();
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array) {
  try {
    const normalized = await normalizeForPdf(bytes);
    const isPng =
      normalized[0] === 0x89 &&
      normalized[1] === 0x50 &&
      normalized[2] === 0x4e &&
      normalized[3] === 0x47;
    const image: PDFImage = isPng
      ? await doc.embedPng(normalized)
      : await doc.embedJpg(normalized);
    return { image, w: image.width, h: image.height };
  } catch {
    return null;
  }
}

async function normalizeForPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const isPng =
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (isPng || isJpg) return bytes;
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp(Buffer.from(bytes)).jpeg({ quality: 85 }).toBuffer();
    return new Uint8Array(buf);
  } catch {
    return bytes;
  }
}

function fit(w: number, h: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / w, maxH / h);
  return { w: w * ratio, h: h * ratio };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export async function fetchHsqImageBytes(
  supabase: {
    storage: {
      from: (b: string) => {
        download: (p: string) => Promise<{ data: Blob | null; error: unknown }>;
      };
    };
  },
  rows: HsqReportImage[]
): Promise<ImageInput[]> {
  const out: ImageInput[] = [];
  for (const row of rows) {
    const { data, error } = await supabase.storage.from("hsq-images").download(row.storage_path);
    if (error || !data) continue;
    out.push({ bytes: new Uint8Array(await data.arrayBuffer()) });
  }
  return out;
}
