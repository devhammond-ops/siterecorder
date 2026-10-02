"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Images, Loader2, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_RECEIPTS_BUCKET } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GALLERY_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic";

interface Props {
  userId: string;
}

export function ExpenseForm({ userId }: Props) {
  const router = useRouter();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const [expenseDate, setExpenseDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)
    );
    if (list.length === 0) {
      setError("Please select image files only.");
      return;
    }
    setPending((prev) => [
      ...prev,
      ...list.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  }

  function removePending(index: number) {
    setPending((prev) => {
      const next = prev.filter((_, i) => i !== index);
      URL.revokeObjectURL(prev[index]?.preview);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;

    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    const amountNum = Number(amount);
    if (!amount.trim() || Number.isNaN(amountNum) || amountNum < 0) {
      setError("Enter a valid amount (0 or greater).");
      return;
    }
    if (!expenseDate) {
      setError("Expense date is required.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    let uploadedPaths: string[] = [];

    try {
      const { data: row, error: insErr } = await supabase
        .from("expenses")
        .insert({
          expense_date: expenseDate,
          description: description.trim(),
          amount: amountNum,
          created_by: userId,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      const expenseId = row.id as string;

      try {
        for (const item of pending) {
          const ext = item.file.name.split(".").pop() || "jpg";
          const path = `${expenseId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(EXPENSE_RECEIPTS_BUCKET)
            .upload(path, item.file, { upsert: false });
          if (upErr) throw upErr;
          uploadedPaths.push(path);

          const { error: imgErr } = await supabase.from("expense_images").insert({
            expense_id: expenseId,
            storage_path: path,
            uploaded_by: userId,
          });
          if (imgErr) throw imgErr;
        }
      } catch (innerErr) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).remove(uploadedPaths);
        }
        await supabase.from("expenses").delete().eq("id", expenseId);
        throw innerErr;
      }

      router.push(`/expenses/${expenseId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
      submittingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Expense details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="expense_date">Date</Label>
            <Input
              id="expense_date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (GHS)</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="What was this expense for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt / invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a photo of the receipt or invoice, or take one with your camera.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => galleryRef.current?.click()}
              disabled={saving}
            >
              <Images className="h-4 w-4" />
              Choose from device
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => cameraRef.current?.click()}
              disabled={saving}
            >
              <Camera className="h-4 w-4" />
              Take photo
            </Button>
          </div>
          <input
            ref={galleryRef}
            type="file"
            accept={GALLERY_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {pending.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {pending.map((item, index) => (
                <div key={item.preview} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePending(index)}
                    className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive shadow"
                    aria-label="Remove image"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Submit expense
        </Button>
      </div>
    </form>
  );
}
