import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { applyInstallationFilters, parseFilters } from "@/lib/filters";
import { CUSTOMER_FIELDS } from "@/lib/constants";
import type { Installation } from "@/lib/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseFilters(sp);

  let query = supabase
    .from("installations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000);
  query = applyInstallationFilters(query, filters);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as Installation[];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Cable Install Recorder";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Installations");

  // Header columns: all customer fields + status + timestamps (no images).
  const columns = [
    ...CUSTOMER_FIELDS.map((f) => ({ header: f.label, key: f.key, width: 22 })),
    { header: "Status", key: "status", width: 14 },
    { header: "Status Comments", key: "status_comments", width: 28 },
    { header: "Comments", key: "comments", width: 28 },
    { header: "Created At", key: "created_at", width: 20 },
  ];
  sheet.columns = columns;

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const row of rows) {
    const record: Record<string, unknown> = {};
    for (const f of CUSTOMER_FIELDS) {
      record[f.key] = (row[f.key as keyof Installation] as string) ?? "";
    }
    record.status = row.status;
    record.status_comments = row.status_comments ?? "";
    record.comments = row.comments ?? "";
    record.created_at = row.created_at ? new Date(row.created_at).toLocaleString() : "";
    sheet.addRow(record);
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `installations-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
