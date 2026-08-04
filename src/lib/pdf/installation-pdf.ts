import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { CUSTOMER_FIELDS, IMAGE_SLOTS } from "@/lib/constants";
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

  // Image evidence — 3-column card grid (matches web layout)
  ensure(24);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A4.w - MARGIN, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 16;
  page.drawText("Image Evidence", { x: MARGIN, y, size: 12, font: bold });
  y -= 14;

  const bySlot = new Map<string, ImageInput[]>();
  for (const img of images) {
    const list = bySlot.get(img.slot) ?? [];
    list.push(img);
    bySlot.set(img.slot, list);
  }

  // Pre-embed all images once
  const embeddedBySlot = new Map<string, { image: PDFImage; w: number; h: number }[]>();
  for (const slot of IMAGE_SLOTS) {
    const slotImages = bySlot.get(slot.key) ?? [];
    const embedded: { image: PDFImage; w: number; h: number }[] = [];
    for (const img of slotImages) {
      const e = await embedImage(doc, img.bytes);
      if (e) embedded.push(e);
    }
    embeddedBySlot.set(slot.key, embedded);
  }

  const GRID_COLS = 3;
  const GRID_GAP = 10;
  const contentW = A4.w - MARGIN * 2;
  const cellW = (contentW - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
  const CARD_PAD = 5;
  const LABEL_H = 22;
  const THUMB_H = 62;
  const CARD_H = CARD_PAD * 2 + LABEL_H + THUMB_H;
  const MINI_GAP = 4;

  for (let row = 0; row < Math.ceil(IMAGE_SLOTS.length / GRID_COLS); row++) {
    ensure(CARD_H + GRID_GAP);
    const rowTop = y;
    y -= CARD_H;

    for (let col = 0; col < GRID_COLS; col++) {
      const slotIdx = row * GRID_COLS + col;
      if (slotIdx >= IMAGE_SLOTS.length) break;

      const slot = IMAGE_SLOTS[slotIdx];
      const x = MARGIN + col * (cellW + GRID_GAP);
      const cardBottom = rowTop - CARD_H;

      // Card border
      page.drawRectangle({
        x,
        y: cardBottom,
        width: cellW,
        height: CARD_H,
        borderColor: rgb(0.82, 0.82, 0.82),
        borderWidth: 0.75,
      });

      // Label
      page.drawText(truncate(slot.label, 30), {
        x: x + CARD_PAD,
        y: rowTop - CARD_PAD - 8,
        size: 7,
        font: bold,
      });

      const thumbs = embeddedBySlot.get(slot.key) ?? [];
      const innerW = cellW - CARD_PAD * 2;
      const innerX = x + CARD_PAD;
      const imgAreaBottom = cardBottom + CARD_PAD;

      if (thumbs.length === 0) {
        page.drawRectangle({
          x: innerX,
          y: imgAreaBottom,
          width: innerW,
          height: THUMB_H,
          borderColor: rgb(0.9, 0.9, 0.9),
          borderWidth: 0.5,
          borderDashArray: [3, 2],
        });
        page.drawText("No photos", {
          x: innerX + 4,
          y: imgAreaBottom + THUMB_H / 2 - 3,
          size: 6,
          font,
          color: rgb(0.6, 0.6, 0.6),
        });
      } else if (thumbs.length === 1) {
        // Single image — fill the card image area
        const t = thumbs[0];
        const dims = fit(t.w, t.h, innerW, THUMB_H);
        page.drawImage(t.image, {
          x: innerX + (innerW - dims.w) / 2,
          y: imgAreaBottom + (THUMB_H - dims.h) / 2,
          width: dims.w,
          height: dims.h,
        });
      } else {
        // 2-column mini-grid — size thumbs to fit BOTH width and height
        const miniCols = 2;
        const miniRows = 2;
        const miniThumb = Math.min(
          (innerW - MINI_GAP) / miniCols,
          (THUMB_H - MINI_GAP) / miniRows
        );

        for (let ti = 0; ti < thumbs.length && ti < miniCols * miniRows; ti++) {
          const miniCol = ti % miniCols;
          const miniRow = Math.floor(ti / miniCols);
          const t = thumbs[ti];
          const tx = innerX + miniCol * (miniThumb + MINI_GAP);
          // Stack rows from the bottom of the image area upward
          const ty = imgAreaBottom + (miniRows - 1 - miniRow) * (miniThumb + MINI_GAP);
          const dims = fit(t.w, t.h, miniThumb, miniThumb);

          page.drawRectangle({
            x: tx,
            y: ty,
            width: miniThumb,
            height: miniThumb,
            borderColor: rgb(0.88, 0.88, 0.88),
            borderWidth: 0.5,
          });
          page.drawImage(t.image, {
            x: tx + (miniThumb - dims.w) / 2,
            y: ty + (miniThumb - dims.h) / 2,
            width: dims.w,
            height: dims.h,
          });
        }
      }
    }

    y -= GRID_GAP;
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
