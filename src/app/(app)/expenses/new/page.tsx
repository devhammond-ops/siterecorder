import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { ExpenseForm } from "@/components/expense-form";

export default async function NewExpensePage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to expenses
      </Link>
      <div>
        <h1 className="text-2xl font-bold">New expense</h1>
        <p className="text-sm text-muted-foreground">
          Enter the date, description, amount, and attach a receipt or invoice photo.
        </p>
      </div>
      <ExpenseForm userId={user.id} />
    </div>
  );
}
