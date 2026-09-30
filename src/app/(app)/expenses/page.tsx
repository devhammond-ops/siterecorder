import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { formatExpenseAmount, listExpenses } from "@/lib/expenses";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ExpensesPage() {
  await requireUser();
  const expenses = await listExpenses();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Raise and track expense claims with receipt evidence.
          </p>
        </div>
        <Link href="/expenses/new">
          <Button>
            <Plus className="h-4 w-4" />
            New expense
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No expenses yet. Raise one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/expenses/${e.id}`} className="font-medium hover:underline">
                          {formatDate(e.expense_date)}
                        </Link>
                      </td>
                      <td className="max-w-[320px] truncate px-3 py-2 text-muted-foreground">
                        {e.description}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {formatExpenseAmount(e.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
