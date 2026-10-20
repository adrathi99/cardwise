export function parseIndianAmount(input: string): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^-/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/[₹$,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  if (Number.isNaN(value)) return null;
  return negative ? -value : value;
}

export function formatINR(value: number, opts: { decimals?: number } = {}): string {
  const decimals = opts.decimals ?? 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const fixed = abs.toFixed(decimals);
  const [intPart = '0', decPart] = fixed.split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return `${sign}₹${grouped}${decPart ? '.' + decPart : ''}`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
