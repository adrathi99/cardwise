import type { BenefitProgress } from './types.ts';
import { inr, titleCase } from './format.ts';

export type BenefitKind = 'earning' | 'milestone' | 'waiver' | 'perk';

const PERK_TITLES: Record<string, string> = {
  'lounge access': 'Airport lounge access',
  'milestone bonus': 'Milestone reward',
  'movie ticket': 'Movie ticket offer',
  golf: 'Golf rounds',
  concierge: 'Travel concierge',
  'fuel waiver': 'Fuel surcharge waiver',
  'hotel membership': 'Hotel loyalty membership',
  insurance: 'Insurance cover',
  'fuel surcharge waiver': 'Fuel surcharge waiver',
};

const SCOPE_LABELS: Record<string, string> = {
  base: 'All eligible spend',
  online_shopping: 'Online shopping',
  offline_shopping: 'Offline shopping',
  travel: 'Travel',
  dining: 'Dining',
  groceries: 'Groceries',
  utilities: 'Utility bills',
  insurance: 'Insurance premiums',
  government: 'Government payments',
  education: 'Education',
  fuel: 'Fuel',
  rent: 'Rent',
  entertainment: 'Entertainment',
  wallet: 'Wallet loads',
  emi: 'EMI',
  other: 'Other',
};

export function benefitKind(p: BenefitProgress): BenefitKind {
  if (p.calcMethod === 'cashback_percent' || p.calcMethod === 'points_per_100' || /-R\d+$/.test(p.code)) return 'earning';
  if (p.calcMethod === 'fee_waiver' && /annual fee|joining fee|renewal fee/i.test(p.name)) return 'waiver';
  if (p.category === 'milestone' || p.calcMethod === 'milestone') return 'milestone';
  return 'perk';
}

export function kindLabel(kind: BenefitKind): string {
  switch (kind) {
    case 'earning':
      return 'Earning rate';
    case 'milestone':
      return 'Milestone';
    case 'waiver':
      return 'Fee waiver';
    default:
      return 'Perk';
  }
}

/** A short, human label for what unlocks, taken from the leading clause of the terms. */
function unlockHint(description: string | null): string | null {
  if (!description) return null;
  const first = description.split(/[.;—]/)[0] ?? description;
  const cut = first.split(/\s+(?:on|at|in|for|after)\s+₹/i)[0] ?? first;
  const trimmed = cut.trim();
  if (!trimmed || trimmed.length > 70) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function benefitShortTitle(p: BenefitProgress): string {
  const kind = benefitKind(p);
  if (kind === 'earning') {
    return p.category === 'base' ? 'Base earning' : `${SCOPE_LABELS[p.category] ?? titleCase(p.category)} earning`;
  }
  if (kind === 'waiver') return 'Annual fee waiver';
  return PERK_TITLES[p.name.trim().toLowerCase()] ?? titleCase(p.name);
}

export function benefitTitle(p: BenefitProgress): string {
  const base = benefitShortTitle(p);
  if (benefitKind(p) !== 'milestone') return base;
  const hint = unlockHint(p.description);
  return hint && hint.toLowerCase() !== base.toLowerCase() ? `${base} · ${hint}` : base;
}

export function earningRate(p: BenefitProgress): string {
  switch (p.calcMethod) {
    case 'cashback_percent':
      return `${p.rewardValue ?? '—'}% cashback`;
    case 'points_per_100':
      return `${p.rewardValue ?? '—'} pts / ₹100`;
    case 'percentage_capped':
      return p.rewardValue ? `${p.rewardValue}%` : '—';
    case 'fee_waiver':
      return 'Fee waived';
    case 'milestone':
    case 'voucher_tier':
      return 'Milestone reward';
    default:
      return '—';
  }
}

export function earningScope(p: BenefitProgress): string {
  if (p.includeAll) return p.category === 'base' ? 'All eligible spend' : `${SCOPE_LABELS[p.category] ?? titleCase(p.category)} · all categories`;
  if (p.eligibleCategories.length === 0) return 'No category restriction';
  return p.eligibleCategories.map((c) => SCOPE_LABELS[c] ?? titleCase(c)).join(', ');
}

export function earningValue(p: BenefitProgress): string | null {
  if (p.earnedValue != null) return inr(p.earnedValue, { decimals: 0 });
  if (p.earnedPoints != null) return `${p.earnedPoints.toLocaleString('en-IN')} pts`;
  return null;
}

export function statusText(status: string): string {
  switch (status) {
    case 'earned':
      return 'Unlocked';
    case 'in_progress':
      return 'In progress';
    case 'not_started':
      return 'Not started';
    case 'earning':
      return 'Earning';
    case 'expired':
      return 'Expired';
    case 'inactive':
      return 'Inactive';
    default:
      return 'Unknown';
  }
}

export function periodLabel(type: string): string {
  switch (type) {
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'calendar_year':
      return 'Calendar year';
    case 'financial_year':
      return 'Financial year';
    case 'anniversary_year':
      return 'Card anniversary year';
    case 'rolling_12m':
      return 'Rolling 12 months';
    default:
      return titleCase(type);
  }
}

export function kindHint(kind: BenefitKind): string {
  switch (kind) {
    case 'earning':
      return 'Applied automatically to matching spend.';
    case 'milestone':
      return 'Unlocks once the spend target is met in the period.';
    case 'waiver':
      return 'Waives a fee once the spend target is met.';
    default:
      return 'Included with the card; activate or use as described.';
  }
}
