import type { BenefitProgress } from '../benefits/engine.ts';
import { round2 } from '../lib/money.ts';

export interface CardContext {
  userCardId: number;
  nickname: string;
  cardName: string;
  issuer: string;
  progress: BenefitProgress[];
  categorySpend: Record<string, number>;
}

export interface Recommendation {
  id: string;
  kind: 'category_switch' | 'milestone' | 'activation' | 'not_worthwhile';
  title: string;
  detail: string;
  reason: string;
  assumptions: string[];
  estimatedValue: number | null;
  category?: string;
  cards?: number[];
}

/** Effective accrual rate (percent of spend) for a category on a card. */
export function effectiveRate(card: CardContext, category: string): number {
  let best = 0;
  for (const p of card.progress) {
    if (p.status === 'inactive' || p.status === 'expired') continue;
    if (p.ratePercent == null) continue;
    // A specific-category benefit only applies to that category; "base" applies broadly.
    const applies = p.category === category || p.category === 'base' || p.category === 'milestone';
    if (!applies) continue;
    if (p.ratePercent > best) best = p.ratePercent;
  }
  return best;
}

export function buildRecommendations(cards: CardContext[]): Recommendation[] {
  const recs: Recommendation[] = [];
  const label = (c: string) => c.replace(/_/g, ' ');

  // 1. Category optimisation from observed spend.
  const categories = new Set<string>();
  for (const c of cards) for (const [cat, amt] of Object.entries(c.categorySpend)) if (amt > 0) categories.add(cat);

  for (const category of categories) {
    const entries = cards.map((c) => ({
      card: c,
      spend: c.categorySpend[category] ?? 0,
      rate: effectiveRate(c, category),
    }));
    const used = entries.slice().sort((a, b) => b.spend - a.spend)[0]!;
    const best = entries.slice().sort((a, b) => b.rate - a.rate)[0]!;
    if (
      used.spend > 0 &&
      best.card.userCardId !== used.card.userCardId &&
      best.rate > used.rate + 0.25
    ) {
      const incremental = round2((used.spend * (best.rate - used.rate)) / 100);
      recs.push({
        id: `cat-${category}`,
        kind: 'category_switch',
        title: `Route ${label(category)} spend to ${best.card.nickname}`,
        detail: `You spent ₹${used.spend.toFixed(0)} on ${label(category)} with ${used.card.nickname}. ${best.card.nickname} earns about ${best.rate.toFixed(1)}% vs ${used.rate.toFixed(1)}%.`,
        reason: `Higher effective reward rate on the same category (${best.rate.toFixed(1)}% vs ${used.rate.toFixed(1)}%).`,
        assumptions: [
          'Rates come from catalogue rules and may be capped or merchant-specific.',
          'Estimate assumes a similar spend pattern next period.',
        ],
        estimatedValue: incremental,
        category,
        cards: [used.card.userCardId, best.card.userCardId],
      });
    }
  }

  // 2. Milestone opportunities + not-worthwhile flags.
  for (const c of cards) {
    for (const p of c.progress) {
      if (p.threshold <= 0 || p.remainingToThreshold <= 0) continue;
      if (p.status === 'inactive' || p.status === 'expired') continue;
      const attainable = p.attainableValue ?? 0;
      if (attainable <= 0) continue;
      const efficiency = attainable / p.remainingToThreshold;
      const verifyNote = p.requiresVerification
        ? ['This benefit is unverified in the catalogue — confirm the exact terms with the official source before acting.']
        : [];
      if (efficiency >= 0.02) {
        recs.push({
          id: `ms-${p.benefitId}`,
          kind: 'milestone',
          title: `₹${p.remainingToThreshold.toFixed(0)} more on ${c.nickname} unlocks ${p.name}`,
          detail: `Estimated reward ₹${attainable.toFixed(0)} before ${p.deadline}.`,
          reason: `Reward equals ~${(efficiency * 100).toFixed(1)}% of the remaining eligible spend, based on your planned/observed spend.`,
          assumptions: [
            'Assumes the remaining spend is genuine and category-eligible.',
            'Verify merchant-level exclusions on the official source.',
            ...verifyNote,
          ],
          estimatedValue: attainable,
          cards: [c.userCardId],
        });
      } else {
        recs.push({
          id: `nw-${p.benefitId}`,
          kind: 'not_worthwhile',
          title: `${p.name} is not worth chasing on ${c.nickname}`,
          detail: `You would need ₹${p.remainingToThreshold.toFixed(0)} more spend for a ~₹${attainable.toFixed(0)} reward.`,
          reason: `Reward is only ~${(efficiency * 100).toFixed(1)}% of the extra spend.`,
          assumptions: ['Do not increase spending solely to reach this milestone.', ...verifyNote],
          estimatedValue: attainable,
          cards: [c.userCardId],
        });
      }
    }
  }

  // 3. Activation-required benefits.
  for (const c of cards) {
    for (const p of c.progress) {
      if (p.requiresActivation && p.status !== 'inactive' && p.status !== 'expired') {
        recs.push({
          id: `act-${p.benefitId}`,
          kind: 'activation',
          title: `${p.name} may need activation or redemption`,
          detail: `${c.nickname}: this benefit can require a separate registration or redemption step.`,
          reason: 'Issuer terms require an explicit user action for this benefit.',
          assumptions: ['Check the official source for the exact activation steps.'],
          estimatedValue: p.attainableValue,
          cards: [c.userCardId],
        });
      }
    }
  }

  const seen = new Set<string>();
  return recs
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .sort((a, b) => (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0));
}
