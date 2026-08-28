/** User-facing message for installation save failures (incl. unique MSISDN). */
export function formatInstallationSaveError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code === "23505") {
      return "An installation with this MSISDN already exists.";
    }
    if (e.message) return e.message;
  }
  if (err instanceof Error) return err.message;
  return "Failed to save";
}
