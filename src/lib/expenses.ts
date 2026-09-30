import { createClient } from "@/lib/supabase/server";
import { EXPENSE_RECEIPTS_BUCKET } from "@/lib/constants";
import type { Expense, ExpenseImage } from "@/lib/types";

export interface ExpenseReceipt {
  id: string;
  path: string;
  url: string;
}

export async function listExpenses(): Promise<Expense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Expense[];
}

export async function getExpenseDetail(id: string): Promise<{
  expense: Expense;
  receipts: ExpenseReceipt[];
} | null> {
  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!expense) return null;

  const { data: images } = await supabase
    .from("expense_images")
    .select("*")
    .eq("expense_id", id)
    .order("created_at", { ascending: true });

  const receipts: ExpenseReceipt[] = [];
  for (const row of (images ?? []) as ExpenseImage[]) {
    const { data: signed } = await supabase.storage
      .from(EXPENSE_RECEIPTS_BUCKET)
      .createSignedUrl(row.storage_path, 3600);
    receipts.push({
      id: row.id,
      path: row.storage_path,
      url: signed?.signedUrl ?? "",
    });
  }

  return { expense: expense as Expense, receipts };
}

export function formatExpenseAmount(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (Number.isNaN(n)) return String(amount);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(n);
}
