export interface InstallationFilters {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): InstallationFilters {
  const get = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    q: get("q") || undefined,
    status: get("status") || undefined,
    from: get("from") || undefined,
    to: get("to") || undefined,
  };
}

/**
 * Applies search / status / date-range filters to a PostgREST query builder.
 * Typed loosely to avoid coupling to supabase-js internal builder generics.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyInstallationFilters<T = any>(query: T, filters: InstallationFilters): T {
  let q = query as any;
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      const like = `%${term}%`;
      q = q.or(
        [
          `customer_name.ilike.${like}`,
          `order_number.ilike.${like}`,
          `msisdn.ilike.${like}`,
          `customer_address.ilike.${like}`,
          `customer_phone.ilike.${like}`,
        ].join(",")
      );
    }
  }
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.from) q = q.gte("date_installation", filters.from);
  if (filters.to) q = q.lte("date_installation", filters.to);
  return q as T;
}
