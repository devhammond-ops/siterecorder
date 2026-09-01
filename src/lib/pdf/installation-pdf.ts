import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { CUSTOMER_FIELDS } from "@/lib/constants";
import type { Installation, InstallationImage } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 40;

interface ImageInput {
  slot: string;
  bytes: Uint8Array;
}

export async function buildInstallationPdf(
  installation: Installation,
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

  // Title
  page.drawText("Installation Record", { x: MARGIN, y: y - 4, size: 18, font: bold });
  y -= 28;
  page.drawText(String(installation.customer_name), {
    x: MARGIN,
    y,
    size: 14,
    font: bold,
  });
  y -= 18;
  page.drawText(
    `Order #${installation.order_number}  |  Status: ${installation.status}  |  Updated: ${formatDateTime(installation.updated_at)}`,
    { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) }
  );
  y -= 20;

  // Customer fields — two columns
  const colWidth = (A4.w - MARGIN * 2) / 2;
  let col = 0;
  let lineY = y;

  for (const f of CUSTOMER_FIELDS) {
    const raw = installation[f.key as keyof Installation];
    const value = f.type === "date" ? formatDate(raw as string) : String(raw ?? "");
    if (!value || value === "-") continue;

    ensure(14);
    if (col === 0) lineY = y;
    const x = MARGIN + col * colWidth;
    page.drawText(`${f.label}: `, { x, y: lineY, size: 8, font: bold });
    const lw = bold.widthOfTextAtSize(`${f.label}: `, 8);
    page.drawText(truncate(value, 52), { x: x + lw, y: lineY, size: 8, font });

    if (col === 1) y = lineY - 12;
    col = col === 0 ? 1 : 0;
  }
  if (col === 1) y = lineY - 12;
  y -= 10;

  function drawTextBlock(label: string, text: string) {
    ensure(40);
    page.drawText(label, { x: MARGIN, y, size: 8, font: bold });
    y -= 12;
    const lines = wrapText(text, 95);
    for (const line of lines) {
      ensure(12);
      page.drawText(line, { x: MARGIN, y, size: 8, font });
      y -= 10;
    }
    y -= 6;
  }

  if (installation.status_comments?.trim()) {
    drawTextBlock("Status Comments:", installation.status_comments.trim());
  }
  if (installation.comments?.trim()) {
    drawTextBlock("Comments:", installation.comments.trim());
  }

  // Site photos + acceptance form grids
  async function drawPhotoSection(title: string, sectionImages: ImageInput[]) {
    ensure(24);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4.w - MARGIN, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 16;
    page.drawText(`${title} (${sectionImages.length})`, {
      x: MARGIN,
      y,
      size: 12,
      font: bold,
    });
    y -= 14;

    if (sectionImages.length === 0) {
      ensure(20);
      page.drawText("No photos", {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: rgb(0.55, 0.55, 0.55),
      });
      y -= 16;
      return;
    }

    const embedded: { image: PDFImage; w: number; h: number }[] = [];
    for (const img of sectionImages) {
      const e = await embedImage(doc, img.bytes);
      if (e) embedded.push(e);
    }

    const GRID_COLS = 3;
    const GRID_GAP = 10;
    const contentW = A4.w - MARGIN * 2;
    const cellW = (contentW - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
    const cellH = 120;

    for (let i = 0; i < embedded.length; i++) {
      const colIdx = i % GRID_COLS;
      if (colIdx === 0) {
        ensure(cellH + GRID_GAP);
        y -= cellH;
      }
      const x = MARGIN + colIdx * (cellW + GRID_GAP);
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
      if (colIdx === GRID_COLS - 1) y -= GRID_GAP;
    }
    if (embedded.length % GRID_COLS !== 0) y -= GRID_GAP;
  }

  const sitePhotos = images.filter((img) => img.slot !== "acceptance_form");
  const acceptanceForms = images.filter((img) => img.slot === "acceptance_form");

  await drawPhotoSection("Site Photos", sitePhotos);
  await drawPhotoSection("Acceptance Form", acceptanceForms);

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

/** Convert WebP/HEIC/unknown formats to JPEG so pdf-lib can embed them. */
async function normalizeForPdf(bytes: Uint8Array): Promise<Uint8Array> {
  // Already PNG or JPEG — use as-is
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

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

/** Download image bytes from Supabase Storage for PDF embedding. */
export async function fetchImageBytes(
  supabase: { storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  rows: InstallationImage[]
): Promise<ImageInput[]> {
  const out: ImageInput[] = [];
  for (const row of rows) {
    const { data, error } = await supabase.storage
      .from("installation-images")
      .download(row.storage_path);
    if (error || !data) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    out.push({ slot: row.slot, bytes });
  }
  return out;
}
