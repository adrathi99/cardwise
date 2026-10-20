import { all, get } from '../db.ts';
import { evaluateCardBenefits, type BenefitRow, type BenefitProgress, type TxnRow } from '../benefits/engine.ts';
import { buildRecommendations, effectiveRate, type CardContext, type Recommendation } from '../recommendations/engine.ts';
import { getPeriod, parseYMD, type PeriodType } from '../lib/periods.ts';
import { round2 } from '../lib/money.ts';
import { CATEGORIES, NON_SPEND_TYPES } from '../lib/categories.ts';

export interface UserCardView {
  id: number;
  profileId: number;
  nickname: string;
  last4: string | null;
  issuedOn: string | null;
  anniversaryDate: string | null;
  cardProductId: number;
  cardName: string;
  issuer: string;
  tier: string;
  network: string | null;
  annualFee: number | null;
  isCustom: number;
  dataConfidence: string;
  verificationStatus: string;
}

export function listUserCards(): UserCardView[] {
  return all<UserCardView>(`
    SELECT uc.id AS id, uc.profile_id AS profileId, uc.nickname AS nickname, uc.last4 AS last4,
           uc.issued_on AS issuedOn, uc.anniversary_date AS anniversaryDate,
           cp.id AS cardProductId, cp.name AS cardName, i.name AS issuer, cp.tier AS tier,
           cp.network AS network, cp.annual_fee AS annualFee, cp.is_custom AS isCustom,
           cp.data_confidence AS dataConfidence, cp.verification_status AS verificationStatus
    FROM user_cards uc
    JOIN card_products cp ON cp.id = uc.card_product_id
    JOIN issuers i ON i.id = cp.issuer_id
    ORDER BY uc.id
  `);
}

export function getCardBenefits(cardProductId: number): BenefitRow[] {
  return all<BenefitRow>(`
    SELECT * FROM benefits b
    WHERE b.card_product_id = ? AND b.status = 'active'
      AND b.version = (SELECT MAX(version) FROM benefits b2 WHERE b2.card_product_id = b.card_product_id AND b2.code = b.code)
    ORDER BY b.id
  `, cardProductId);
}

export function getCardTransactions(userCardId: number): TxnRow[] {
  return all<TxnRow>(
    'SELECT id, user_card_id, txn_date, amount, direction, txn_type, category, confidence FROM transactions WHERE user_card_id = ?',
    userCardId,
  );
}

function resolvePeriod(period: string | undefined, refDate: Date): { start: string; end: string; label: string; type: string } {
  const requested = period ?? 'financial_year';
  if (requested === 'all') {
    const row = get<{ min: string | null; max: string | null }>('SELECT MIN(txn_date) AS min, MAX(txn_date) AS max FROM transactions');
    const start = row?.min ?? '2000-01-01';
    const end = row?.max ?? '2100-12-31';
    return { start, end, label: 'All imported transactions', type: 'all' };
  }
  const type = requested as PeriodType;
  const p = getPeriod(type, refDate);
  return { start: p.start, end: p.end, label: p.label, type: p.periodType };
}

export interface CardAnalytics {
  card: UserCardView;
  period: { start: string; end: string; label: string; type: string };
  progress: BenefitProgress[];
  totalSpend: number;
  eligibleSpend: number;
  earnedValue: number;
  pendingValue: number;
  attainableValue: number;
  categorySpend: Record<string, number>;
  nextDeadline: { benefitName: string; date: string; remaining: number } | null;
}

export interface OverviewMetrics {
  period: { start: string; end: string; label: string; type: string };
  totalSpend: number;
  eligibleSpend: number;
  estimatedEarned: number;
  pendingCredit: number;
  benefitsUnlocked: number;
  potentialAttainable: number;
  cardCount: number;
  upcomingDeadlines: { benefitId: number; name: string; cardNickname: string; date: string; remaining: number; value: number }[];
}

export interface Portfolio {
  cards: CardAnalytics[];
  overview: OverviewMetrics;
}

export function buildPortfolio(opts: { period?: string; refDate?: Date } = {}): Portfolio {
  const refDate = opts.refDate ?? new Date();
  const period = resolvePeriod(opts.period, refDate);
  const cards = listUserCards();

  const out: CardAnalytics[] = [];
  const deadlines: OverviewMetrics['upcomingDeadlines'] = [];
  let totalSpend = 0;
  let eligibleSpend = 0;
  let estimatedEarned = 0;
  let pendingCredit = 0;
  let potentialAttainable = 0;
  let benefitsUnlocked = 0;

  for (const card of cards) {
    const txns = getCardTransactions(card.id);
    const benefits = getCardBenefits(card.cardProductId);
    const anniversary = parseYMD(card.anniversaryDate);
    const progress = evaluateCardBenefits(benefits, txns, { refDate, anniversaryDate: anniversary, annualFee: card.annualFee });

    // Union of categories any benefit on this card can earn on. Used for the
    // portfolio "eligible spend" metric so a transaction is never double counted.
    const eligibleCats = new Set<string>();
    for (const b of benefits) {
      if (b.include_all === 1) {
        const excl = parseJsonList(b.excluded_categories);
        for (const cat of CATEGORIES) if (!excl.includes(cat)) eligibleCats.add(cat);
      } else {
        for (const cat of parseJsonList(b.eligible_categories)) eligibleCats.add(cat);
      }
    }

    let cardSpend = 0;
    let cardEligible = 0;
    const categorySpend: Record<string, number> = {};
    for (const t of txns) {
      if (t.txn_date < period.start || t.txn_date > period.end) continue;
      if (t.txn_type === 'refund') {
        categorySpend[t.category] = round2((categorySpend[t.category] ?? 0) - t.amount);
        cardSpend -= t.amount;
        if (eligibleCats.has(t.category)) cardEligible -= t.amount;
        continue;
      }
      if (t.direction === 'credit' || (NON_SPEND_TYPES as string[]).includes(t.txn_type)) continue;
      cardSpend += t.amount;
      if (eligibleCats.has(t.category)) cardEligible += t.amount;
      categorySpend[t.category] = round2((categorySpend[t.category] ?? 0) + t.amount);
    }
    cardSpend = round2(Math.max(0, cardSpend));
    cardEligible = round2(Math.max(0, cardEligible));

    let cardEarned = 0;
    let cardPending = 0;
    let cardAttainable = 0;
    for (const p of progress) {
      cardEarned += p.earnedValue ?? 0;
      if (p.status === 'earning' || p.status === 'in_progress') {
        cardPending += p.earnedValue ?? 0;
        cardAttainable += Math.max(0, (p.attainableValue ?? 0) - (p.earnedValue ?? 0));
      }
      if (p.status === 'earned') benefitsUnlocked++;
      if (p.threshold > 0 && p.remainingToThreshold > 0 && p.status !== 'inactive' && p.status !== 'expired') {
        const days = (parseYMD(p.deadline)?.getTime() ?? 0) - refDate.getTime();
        if (days >= 0 && days <= 1000 * 3600 * 24 * 90) {
          deadlines.push({
            benefitId: p.benefitId,
            name: p.name,
            cardNickname: card.nickname || card.cardName,
            date: p.deadline,
            remaining: p.remainingToThreshold,
            value: p.attainableValue ?? 0,
          });
        }
      }
    }

    const nextDeadlineProgress = progress
      .filter((p) => p.threshold > 0 && p.remainingToThreshold > 0)
      .sort((a, b) => (a.deadline < b.deadline ? -1 : 1))[0];

    out.push({
      card,
      period,
      progress,
      totalSpend: cardSpend,
      eligibleSpend: round2(cardEligible),
      earnedValue: round2(cardEarned),
      pendingValue: round2(cardPending),
      attainableValue: round2(cardAttainable),
      categorySpend,
      nextDeadline: nextDeadlineProgress
        ? { benefitName: nextDeadlineProgress.name, date: nextDeadlineProgress.deadline, remaining: nextDeadlineProgress.remainingToThreshold }
        : null,
    });

    totalSpend += cardSpend;
    eligibleSpend += cardEligible;
    estimatedEarned += cardEarned;
    pendingCredit += cardPending;
    potentialAttainable += cardAttainable;
  }

  deadlines.sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    cards: out,
    overview: {
      period,
      totalSpend: round2(totalSpend),
      eligibleSpend: round2(eligibleSpend),
      estimatedEarned: round2(estimatedEarned),
      pendingCredit: round2(pendingCredit),
      benefitsUnlocked,
      potentialAttainable: round2(potentialAttainable),
      cardCount: cards.length,
      upcomingDeadlines: deadlines.slice(0, 8),
    },
  };
}

function parseJsonList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return json.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

export function getRecommendations(period?: string): Recommendation[] {
  const portfolio = buildPortfolio({ period });
  const contexts: CardContext[] = portfolio.cards.map((c) => ({
    userCardId: c.card.id,
    nickname: c.card.nickname || c.card.cardName,
    cardName: c.card.cardName,
    issuer: c.card.issuer,
    progress: c.progress,
    categorySpend: c.categorySpend,
  }));
  return buildRecommendations(contexts);
}

export { effectiveRate };
