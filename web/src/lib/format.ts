export function inr(n: number | null | undefined, opts: { decimals?: number } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const d = opts.decimals ?? (Math.abs(n) < 1000 ? 2 : 0);
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function inrCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (abs >= 1e5) return '₹' + (n / 1e5).toFixed(2) + ' L';
  return inr(n);
}

export function pct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dayMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function daysUntil(iso: string): number {
  const d = new Date(iso + 'T00:00:00').getTime();
  return Math.round((d - Date.now()) / 86400000);
}

export function titleCase(s: string): string {
  return s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
