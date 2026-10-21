import { getPeriod, parseYMD, type Period, type PeriodType } from '../lib/periods.ts';
import { NON_SPEND_TYPES, type TxnType } from '../lib/categories.ts';
import { round2 } from '../lib/money.ts';

export interface BenefitRow {
  id: number;
  card_product_id: number;
  code: string;
  name: string;
  category: string;
  description: string | null;
  reward_type: string;
  reward_value: number | null;
  reward_points: number | null;
  point_value_inr: number | null;
  threshold_amount: number | null;
  min_eligible_spend: number | null;
  calc_method: string;
  include_all: number;
  eligible_categories: string | null;
  excluded_categories: string | null;
  cap_amount: number | null;
  cap_points: number | null;
  period_type: string;
  period_start_rule: string | null;
  requires_anniversary: number;
  requires_activation: number;
  effective_from: string | null;
  effective_until: string | null;
  redemption_instructions: string | null;
  expiry_rules: string | null;
  source_url: string | null;
  source_label: string | null;
  verified_at: string | null;
  confidence: string;
  status: string;
  version: number;
}

export interface TxnRow {
  id: number;
  user_card_id: number;
  txn_date: string;
  amount: number;
  direction: string;
  txn_type: string;
  category: string;
  confidence: number;
}

export interface CardProductLite {
  id: number;
  annual_fee: number | null;
  name: string;
}

export type BenefitStatus = 'not_started' | 'in_progress' | 'earning' | 'earned' | 'expired' | 'inactive' | 'uncertain';

export interface BenefitProgress {
  benefitId: number;
  code: string;
  name: string;
  category: string;
  description: string | null;
  rewardType: string;
  rewardValue: number | null;
  calcMethod: string;
  includeAll: boolean;
  eligibleCategories: string[];
  excludedCategories: string[];
  period: { type: PeriodType; start: string; end: string; label: string; nextReset: string; basedOnAnniversary: boolean };
  eligibleSpend: number;
  threshold: number;
  remainingToThreshold: number;
  progressPct: number;
  cap: number | null;
  capRemaining: number | null;
  earnedValue: number | null;
  earnedPoints: number | null;
  attainableValue: number | null;
  valueIsKnown: boolean;
  ratePercent: number | null;
  status: BenefitStatus;
  deadline: string;
  requiresActivation: boolean;
  requiresVerification: boolean;
  confidence: number;
  uncertainInputs: boolean;
  eligibleTxnCount: number;
  refundAdjustment: number;
  officialSource: { url: string | null; label: string | null; verifiedAt: string | null; confidence: string };
  redemption: string | null;
  expiryRules: string | null;
  explanation: string[];
}

const CONFIDENCE_SCORE: Record<string, number> = {
  verified: 1,
  high: 0.9,
  medium: 0.7,
  indicative: 0.5,
  unverified: 0.3,
};

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return json.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function isNonSpend(t: string): boolean {
  return (NON_SPEND_TYPES as string[]).includes(t);
}

export function evaluateBenefit(
  benefit: BenefitRow,
  txns: TxnRow[],
  opts: { refDate: Date; anniversaryDate?: Date | null; annualFee?: number | null },
): BenefitProgress {
  const period: Period = getPeriod(benefit.period_type as PeriodType, opts.refDate, opts.anniversaryDate ?? null);
  const eligible: string[] = benefit.include_all ? [] : parseList(benefit.eligible_categories);
  const excluded: string[] = parseList(benefit.excluded_categories);
  const useAll = benefit.include_all === 1;

  const explanation: string[] = [
    `Period: ${period.label} (${period.start} to ${period.end}).`,
    useAll ? 'Eligibility: all purchase categories except exclusions.' : `Eligibility: ${eligible.length ? eligible.join(', ') : 'none configured'}.`,
  ];

  let spend = 0;
  let refunds = 0;
  let eligibleTxnCount = 0;
  let uncertainInputs = false;

  for (const t of txns) {
    if (t.txn_date < period.start || t.txn_date > period.end) continue;
    if (isNonSpend(t.txn_type)) continue;

    const categoryOk = useAll ? !excluded.includes(t.category) : eligible.includes(t.category);
    if (!categoryOk) continue;

    if (t.txn_type === 'refund') {
      refunds += t.amount;
      if (t.amount > 0) explanation.push(`Refund/reversal of ₹${t.amount.toFixed(2)} on ${t.txn_date} reduces eligible spend.`);
      continue;
    }
    if (t.direction === 'credit') {
      // unexplained credit in an eligible category; treat as reversal
      refunds += t.amount;
      continue;
    }
    spend += t.amount;
    eligibleTxnCount++;
    if (t.confidence < 0.5) {
      uncertainInputs = true;
      explanation.push(`Low-confidence classification (${t.category}) for ${t.txn_date} ₹${t.amount.toFixed(2)}.`);
    }
  }

  const eligibleSpend = round2(Math.max(0, spend - refunds));
  const threshold = benefit.threshold_amount ?? benefit.min_eligible_spend ?? 0;
  const cap = benefit.cap_amount ?? null;

  let earnedValue: number | null = 0;
  let earnedPoints: number | null = null;
  let attainableValue: number | null = null;
  let valueIsKnown = true;
  let ratePercent: number | null = null;
  let status: BenefitStatus = 'in_progress';

  const metThreshold = threshold <= 0 || eligibleSpend >= threshold;

  switch (benefit.calc_method) {
    case 'milestone':
    case 'voucher_tier': {
      const reward = benefit.reward_value;
      if (reward == null) {
        earnedValue = null;
        attainableValue = null;
        valueIsKnown = false;
        explanation.push(
          metThreshold
            ? `Threshold of ₹${threshold.toFixed(0)} met; the reward is described in the card terms.`
            : `Needs ₹${(threshold - eligibleSpend).toFixed(0)} more eligible spend to reach the ₹${threshold.toFixed(0)} milestone.`,
        );
      } else {
        earnedValue = metThreshold ? reward : 0;
        attainableValue = reward;
        explanation.push(
          metThreshold
            ? `Milestone reached at ₹${threshold.toFixed(0)}; reward of ₹${reward.toFixed(0)} unlocked.`
            : `Needs ₹${(threshold - eligibleSpend).toFixed(0)} more eligible spend to reach the ₹${threshold.toFixed(0)} milestone.`,
        );
      }
      status = metThreshold ? 'earned' : eligibleSpend > 0 ? 'in_progress' : 'not_started';
      break;
    }
    case 'cashback_percent': {
      const rate = benefit.reward_value ?? 0;
      ratePercent = rate;
      const raw = (eligibleSpend * rate) / 100;
      earnedValue = round2(cap != null ? Math.min(raw, cap) : raw);
      attainableValue = cap != null ? cap : null;
      explanation.push(`Cashback at ${rate}% on ₹${eligibleSpend.toFixed(0)} = ₹${raw.toFixed(2)}${cap != null ? `, capped at ₹${cap.toFixed(0)}` : ''}.`);
      status = 'earning';
      if (eligibleSpend === 0) status = 'not_started';
      break;
    }
    case 'points_per_100': {
      const rate = benefit.reward_value ?? 0;
      const points = Math.floor((eligibleSpend / 100) * rate);
      earnedPoints = points;
      if (benefit.point_value_inr != null) ratePercent = round2(rate * benefit.point_value_inr);
      if (benefit.point_value_inr != null) {
        earnedValue = round2(points * benefit.point_value_inr);
        explanation.push(`${rate} points per ₹100 on ₹${eligibleSpend.toFixed(0)} = ${points} points (≈₹${earnedValue.toFixed(0)} at ₹${benefit.point_value_inr}/point).`);
      } else {
        earnedValue = null;
        valueIsKnown = false;
        explanation.push(`${rate} points per ₹100 on ₹${eligibleSpend.toFixed(0)} = ${points} points. Redemption value not established.`);
      }
      status = eligibleSpend === 0 ? 'not_started' : 'earning';
      break;
    }
    case 'percentage_capped': {
      const rate = benefit.reward_value ?? 0;
      if (rate > 0) {
        ratePercent = rate;
        const raw = (eligibleSpend * rate) / 100;
        earnedValue = round2(cap != null ? Math.min(raw, cap) : raw);
        attainableValue = cap;
        explanation.push(`Value at ${rate}% on eligible spend${cap != null ? `, capped at ₹${cap.toFixed(0)}` : ''}.`);
      } else {
        // Typical perk: the value is qualitative (visits, vouchers), so there is
        // no rupee figure to compute on eligible spend.
        earnedValue = null;
        attainableValue = null;
        valueIsKnown = false;
      }
      status = metThreshold ? 'earned' : eligibleSpend > 0 ? 'in_progress' : 'not_started';
      break;
    }
    case 'fee_waiver': {
      const fee = opts.annualFee ?? benefit.reward_value ?? 0;
      earnedValue = metThreshold ? fee : 0;
      attainableValue = fee;
      explanation.push(
        metThreshold
          ? `Fee-waiver threshold met; ₹${fee.toFixed(0)} annual fee is waived.`
          : `Needs ₹${(threshold - eligibleSpend).toFixed(0)} more spend to waive the ₹${fee.toFixed(0)} annual fee.`,
      );
      status = metThreshold ? 'earned' : eligibleSpend > 0 ? 'in_progress' : 'not_started';
      break;
    }
    default: {
      earnedValue = null;
      valueIsKnown = false;
      status = 'uncertain';
      explanation.push('Unknown calculation method; value not computed.');
    }
  }

  // Effective dates
  if (benefit.status !== 'active') status = 'inactive';
  if (benefit.effective_until && opts.refDate > (parseYMD(benefit.effective_until) ?? new Date(0))) status = 'expired';
  if (benefit.effective_from && opts.refDate < (parseYMD(benefit.effective_from) ?? new Date(0))) status = 'inactive';

  const capRemaining = cap != null ? round2(Math.max(0, cap - (earnedValue ?? 0))) : null;
  const remainingToThreshold = round2(Math.max(0, threshold - eligibleSpend));
  const progressPct = threshold > 0 ? Math.min(100, round2((eligibleSpend / threshold) * 100)) : eligibleSpend > 0 ? 100 : 0;

  const confidence = (CONFIDENCE_SCORE[benefit.confidence] ?? 0.4) * (uncertainInputs ? 0.8 : 1);

  return {
    benefitId: benefit.id,
    code: benefit.code,
    name: benefit.name,
    category: benefit.category,
    description: benefit.description,
    rewardType: benefit.reward_type,
    rewardValue: benefit.reward_value,
    calcMethod: benefit.calc_method,
    includeAll: useAll,
    eligibleCategories: eligible,
    excludedCategories: excluded,
    period: { type: period.periodType, start: period.start, end: period.end, label: period.label, nextReset: period.nextReset, basedOnAnniversary: period.basedOnAnniversary },
    eligibleSpend,
    threshold,
    remainingToThreshold,
    progressPct,
    cap,
    capRemaining,
    earnedValue,
    earnedPoints,
    attainableValue,
    valueIsKnown,
    ratePercent,
    status,
    deadline: period.end,
    requiresActivation: benefit.requires_activation === 1,
    requiresVerification: benefit.confidence === 'unverified' || benefit.confidence === 'indicative',
    confidence: round2(confidence),
    uncertainInputs,
    eligibleTxnCount,
    refundAdjustment: round2(refunds),
    officialSource: { url: benefit.source_url, label: benefit.source_label, verifiedAt: benefit.verified_at, confidence: benefit.confidence },
    redemption: benefit.redemption_instructions,
    expiryRules: benefit.expiry_rules,
    explanation,
  };
}

export function evaluateCardBenefits(
  benefits: BenefitRow[],
  txns: TxnRow[],
  opts: { refDate: Date; anniversaryDate?: Date | null; annualFee?: number | null },
): BenefitProgress[] {
  return benefits.map((b) =>
    evaluateBenefit(b, txns, {
      refDate: opts.refDate,
      anniversaryDate: b.requires_anniversary === 1 ? opts.anniversaryDate ?? null : opts.anniversaryDate ?? null,
      annualFee: opts.annualFee ?? null,
    }),
  );
}
