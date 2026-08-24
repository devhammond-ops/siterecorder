// Supabase Edge Function: generate-report
//
// Invoked hourly by pg_cron ({ "trigger": "cron" }) or on-demand for a test
// ({ "schedule_id": "...", "test": true }). It figures out which report
// schedules are due, builds a PDF (customer info + image grid per entry) with
// pdf-lib, stores it in the `reports` bucket, and emails it via Resend.
//
// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const REPORT_FROM_EMAIL = Deno.env.get("REPORT_FROM_EMAIL") ?? "reports@example.com";

const INFO_FIELDS: { key: string; label: string }[] = [
  { key: "order_number", label: "Order #" },
  { key: "status", label: "Status" },
  { key: "date_order_received", label: "Order Received" },
  { key: "date_installation", label: "Installed" },
  { key: "msisdn", label: "MSISDN" },
  { key: "fttx_number", label: "FTTX #" },
  { key: "customer_phone", label: "Phone" },
  { key: "customer_address", label: "Address" },
  { key: "gps_address", label: "Ghana Post Address" },
  { key: "gps_lat", label: "GPS Lat" },
  { key: "gps_lng", label: "GPS Lng" },
  { key: "device_serial", label: "Device S/N" },
  { key: "network_type", label: "Network Type" },
  { key: "network_box_id", label: "Network Box ID" },
  { key: "atb_power_readings", label: "ATB Power" },
  { key: "cable_length", label: "Cable Length" },
  { key: "dead_end", label: "Dead End" },
];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const isTest = body?.test === true;
    const explicitScheduleId: string | undefined = body?.schedule_id;

    const { data: schedules, error } = await admin
      .from("report_schedules")
      .select("*")
      .eq("active", true);
    if (error) throw error;

    const now = new Date();
    const results: any[] = [];

    for (const schedule of schedules ?? []) {
      const due =
        isTest && explicitScheduleId
          ? schedule.id === explicitScheduleId
          : isDue(schedule, now);
      if (!due) continue;

      try {
        const result = await processSchedule(schedule, now, isTest);
        results.push({ schedule: schedule.name, ...result });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await admin.from("report_runs").insert({
          schedule_id: schedule.id,
          status: "error",
          error: message,
        });
        results.push({ schedule: schedule.name, status: "error", error: message });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});

function isDue(schedule: any, now: Date): boolean {
  if (now.getUTCHours() !== schedule.send_hour) return false;

  // Avoid duplicate sends within the same UTC day.
  if (schedule.last_run_at) {
    const last = new Date(schedule.last_run_at);
    const sameDay =
      last.getUTCFullYear() === now.getUTCFullYear() &&
      last.getUTCMonth() === now.getUTCMonth() &&
      last.getUTCDate() === now.getUTCDate();
    if (sameDay) return false;
  }

  if (schedule.frequency === "weekly") {
    return now.getUTCDay() === (schedule.day_of_week ?? 1);
  }
  if (schedule.frequency === "monthly") {
    return now.getUTCDate() === (schedule.day_of_month ?? 1);
  }
  return false;
}

function resolvePeriod(schedule: any, now: Date): { from: Date | null; to: Date } {
  if (schedule.date_range_mode === "all") return { from: null, to: now };
  if (schedule.date_range_mode === "custom") {
    return {
      from: schedule.custom_from ? new Date(schedule.custom_from) : null,
      to: schedule.custom_to ? new Date(schedule.custom_to) : now,
    };
  }
  // period: since last run, else a rolling window based on frequency
  if (schedule.last_run_at) return { from: new Date(schedule.last_run_at), to: now };
  const from = new Date(now);
  if (schedule.frequency === "monthly") from.setUTCMonth(from.getUTCMonth() - 1);
  else from.setUTCDate(from.getUTCDate() - 7);
  return { from, to: now };
}

async function processSchedule(schedule: any, now: Date, isTest: boolean) {
  const { from, to } = resolvePeriod(schedule, now);

  let query = admin
    .from("installations")
    .select("*")
    .order("created_at", { ascending: true });

  if (schedule.date_range_mode === "custom") {
    if (schedule.custom_from) query = query.gte("date_installation", schedule.custom_from);
    if (schedule.custom_to) query = query.lte("date_installation", schedule.custom_to);
  } else if (schedule.date_range_mode === "period" && from) {
    query = query.gte("created_at", from.toISOString());
  }
  if (schedule.status_filter) query = query.eq("status", schedule.status_filter);

  const { data: installations, error } = await query;
  if (error) throw error;

  const pdfBytes = await buildPdf(schedule, installations ?? [], from, to);

  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const pdfPath = `${schedule.id}/${stamp}.pdf`;
  const { error: upErr } = await admin.storage
    .from("reports")
    .upload(pdfPath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;

  const recipients: string[] = schedule.recipients ?? [];
  let recipientCount = 0;
  if (recipients.length > 0) {
    await sendEmail(schedule, recipients, pdfBytes, from, to, (installations ?? []).length);
    recipientCount = recipients.length;
  }

  await admin.from("report_runs").insert({
    schedule_id: schedule.id,
    period_from: from ? from.toISOString().slice(0, 10) : null,
    period_to: to.toISOString().slice(0, 10),
    recipient_count: recipientCount,
    pdf_path: pdfPath,
    status: "success",
  });

  if (!isTest) {
    await admin
      .from("report_schedules")
      .update({ last_run_at: now.toISOString() })
      .eq("id", schedule.id);
  }

  return {
    status: "success",
    installations: (installations ?? []).length,
    recipients: recipientCount,
    pdfPath,
  };
}

async function buildPdf(schedule: any, installations: any[], from: Date | null, to: Date) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const A4 = { w: 595.28, h: 841.89 };
  const margin = 40;
  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - margin;
    }
  };

  // Title block
  page.drawText("Installation Report", { x: margin, y: y - 6, size: 20, font: bold });
  y -= 26;
  const period =
    (from ? from.toISOString().slice(0, 10) : "start") +
    "  to  " +
    to.toISOString().slice(0, 10);
  page.drawText(`${schedule.name}  |  Period: ${period}`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 14;
  page.drawText(`${installations.length} installation(s)`, {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 20;

  for (const inst of installations) {
    ensure(80);
    // Divider
    page.drawLine({
      start: { x: margin, y },
      end: { x: A4.w - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 18;

    page.drawText(String(inst.customer_name ?? "Unknown"), {
      x: margin,
      y,
      size: 14,
      font: bold,
    });
    y -= 16;

    // Info fields, two columns
    const colWidth = (A4.w - margin * 2) / 2;
    let col = 0;
    let lineY = y;
    for (const f of INFO_FIELDS) {
      const value = inst[f.key];
      if (value === null || value === undefined || value === "") continue;
      const x = margin + col * colWidth;
      ensure(14);
      if (col === 0) lineY = y;
      page.drawText(`${f.label}: `, { x, y: lineY, size: 8, font: bold });
      const labelWidth = bold.widthOfTextAtSize(`${f.label}: `, 8);
      page.drawText(truncate(String(value), 48), {
        x: x + labelWidth,
        y: lineY,
        size: 8,
        font,
      });
      if (col === 1) {
        y = lineY - 12;
      }
      col = col === 0 ? 1 : 0;
    }
    if (col === 1) y = lineY - 12;
    y -= 6;

    // Images
    const { data: imgs } = await admin
      .from("installation_images")
      .select("slot, storage_path")
      .eq("installation_id", inst.id)
      .order("created_at", { ascending: true });

    if (imgs && imgs.length > 0) {
      const thumb = 110;
      const gap = 8;
      const perRow = Math.floor((A4.w - margin * 2 + gap) / (thumb + gap));
      let idx = 0;
      for (const img of imgs) {
        const embedded = await embedImage(doc, img.storage_path);
        if (!embedded) continue;
        const rowPos = idx % perRow;
        if (rowPos === 0) {
          ensure(thumb + 24);
          y -= thumb;
        }
        const x = margin + rowPos * (thumb + gap);
        const dims = fit(embedded.width, embedded.height, thumb, thumb);
        page.drawImage(embedded.image, {
          x,
          y: y + (thumb - dims.h),
          width: dims.w,
          height: dims.h,
        });
        page.drawText(
          img.slot === "acceptance_form" ? `Form ${idx + 1}` : `Photo ${idx + 1}`,
          {
          x,
          y: y - 10,
          size: 6,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });
        idx++;
        if (rowPos === perRow - 1) y -= 18;
      }
      if (idx % perRow !== 0) y -= 18;
    } else {
      ensure(14);
      page.drawText("No photos", { x: margin, y, size: 8, font, color: rgb(0.6, 0.6, 0.6) });
      y -= 12;
    }
    y -= 10;
  }

  return await doc.save();
}

async function embedImage(doc: PDFDocument, path: string) {
  try {
    const { data, error } = await admin.storage.from("installation-images").download(path);
    if (error || !data) return null;
    const bytes = new Uint8Array(await data.arrayBuffer());
    // Detect PNG signature; otherwise assume JPEG.
    const isPng =
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    return { image, width: image.width, height: image.height };
  } catch {
    return null;
  }
}

function fit(w: number, h: number, maxW: number, maxH: number) {
  const ratio = Math.min(maxW / w, maxH / h);
  return { w: w * ratio, h: h * ratio };
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function sendEmail(
  schedule: any,
  recipients: string[],
  pdfBytes: Uint8Array,
  from: Date | null,
  to: Date,
  count: number
) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  const base64 = base64Encode(pdfBytes);
  const period =
    (from ? from.toISOString().slice(0, 10) : "start") + " to " + to.toISOString().slice(0, 10);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: REPORT_FROM_EMAIL,
      to: recipients,
      subject: `Installation Report: ${schedule.name} (${period})`,
      html: `<p>Attached is the scheduled installation report <strong>${schedule.name}</strong>.</p>
             <p>Period: ${period}<br/>Installations: ${count}</p>`,
      attachments: [
        {
          filename: `installation-report-${to.toISOString().slice(0, 10)}.pdf`,
          content: base64,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
