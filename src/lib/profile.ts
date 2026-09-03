/** Build signature initials from a display name (e.g. "Jane Technician" → "JT"). */
export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.length >= 2 ? w.slice(0, 2).toUpperCase() : w.toUpperCase();
  }
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}${last}`.toUpperCase();
}

export function profileSignature(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return "?";
  return initialsFromName(fullName.trim());
}
