import { get, insert, run } from '../db.ts';
import {
  CARDADVISOR_ATTRIBUTION,
  fetchDataset,
  fetchMeta,
  type CardAdvisorCard,
  type CardAdvisorDataset,
} from './cardadvisor.ts';

/**
 * Maps CardAdvisor's open dataset into CARDWISE's card_products / benefits
 * tables. CardAdvisor rows are facts only (fees, effective reward rates, perk
 * types); CARDWISE's benefit engine expects a calc method and period, so each
 * reward row and perk row is mapped to the closest calc method with the
 * confidence set to reflect that this is imported, machine-readable data.
 *
 * The importer is idempotent: cards are keyed on slug, and a benefit is only
 * inserted when its (card, code, version) does not already exist.
 */

const TIER_MAP: Record<string, string> = {
  ENTRY: 'entry',
  MID: 'mid',
  PREMIUM: 'premium',
  SUPER_PREMIUM: 'super_premium',
};

const REWARD_TYPE_MAP: Record<string, string> = {
  CASHBACK: 'cashback',
  REWARD_POINTS: 'reward_points',
  AIRLINE_MILES: 'reward_points',
  HOTEL_POINTS: 'reward_points',
};

const CATEGORY_MAP: Record<string, string> = {
  DEFAULT: 'base',
  ONLINE_SHOPPING: 'online_shopping',
  OFFLINE_SHOPPING: 'offline_shopping',
  UTILITY_BILLS: 'utilities',
  TRAVEL: 'travel',
  DINING: 'dining',
  GROCERY: 'groceries',
  INSURANCE: 'insurance',
  INTERNATIONAL: 'travel',
  GOVERNMENT: 'government',
  EDUCATION: 'education',
  FUEL: 'fuel',
  RENT: 'rent',
  OTT_SUBSCRIPTIONS: 'entertainment',
  WALLET: 'wallet',
  EMI: 'emi',
};

const PERK_CATEGORY_MAP: Record<string, { category: string; rewardType: string }> = {
  LOUNGE_ACCESS: { category: 'lounge', rewardType: 'lounge' },
  FUEL_WAIVER: { category: 'fuel', rewardType: 'fee_waiver' },
  MILESTONE_BONUS: { category: 'milestone', rewardType: 'reward_points' },
  INSURANCE: { category: 'insurance', rewardType: 'discount' },
  GOLF: { category: 'golf', rewardType: 'discount' },
  MOVIE_TICKET: { category: 'entertainment', rewardType: 'discount' },
  HOTEL_MEMBERSHIP: { category: 'travel', rewardType: 'discount' },
  CONCIERGE: { category: 'concierge', rewardType: 'discount' },
  COBRANDED_OTT: { category: 'entertainment', rewardType: 'discount' },
};

export interface ImportResult {
  cards: number;
  benefits: number;
  skipped: number;
  asOf: string | null;
  version: string | null;
  attribution: string;
}

function slugifyIssuer(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureIssuer(name: string): number {
  const slug = slugifyIssuer(name) || 'unknown';
  const existing = get<{ id: number }>('SELECT id FROM issuers WHERE slug = ?', slug);
  if (existing) return existing.id;
  return insert('INSERT INTO issuers (name, slug) VALUES (?, ?)', name, slug);
}

function calcForReward(rewardType: string): string {
  if (rewardType === 'CASHBACK') return 'cashback_percent';
  return 'points_per_100';
}

/** Import one CardAdvisor card into the DB. Returns counts plus the product id. */
function importCard(card: CardAdvisorCard): { productId: number; benefits: number; created: boolean } {
  const issuerId = ensureIssuer(card.issuer);
  const tier = (card.tier && TIER_MAP[card.tier]) || 'mid';

  let product = get<{ id: number }>('SELECT id FROM card_products WHERE slug = ?', card.cardKey);
  let created = false;
  if (!product) {
    const id = insert(
      `INSERT INTO card_products
        (issuer_id, slug, name, variant, network, tier, annual_fee, fee_waiver_spend, fee_waiver_period,
         reward_program, official_url, data_confidence, verification_status, verified_at, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      issuerId,
      card.cardKey,
      card.name,
      null,
      card.network,
      tier,
      card.annualFeeRs ?? null,
      card.feeWaiverSpendRs ?? null,
      card.feeWaiverSpendRs != null ? 'anniversary_year' : null,
      null,
      card.url,
      'medium',
      'unverified',
      card.lastVerified ?? null,
      `Imported from CardAdvisor. ${CARDADVISOR_ATTRIBUTION}`,
    );
    product = { id };
    created = true;
  }

  let benefits = 0;
  let seq = 0;
  const insertBenefit = (args: {
    code: string;
    name: string;
    category: string;
    description: string;
    rewardType: string;
    calcMethod: string;
    rewardValue: number | null;
    pointValueInr: number | null;
    capAmount: number | null;
    includeAll: boolean;
    eligibleCategories: string[] | null;
    excludedCategories: string[] | null;
    periodType: string;
  }) => {
    const exists = get<{ id: number }>(
      'SELECT id FROM benefits WHERE card_product_id = ? AND code = ? AND version = 1',
      product.id,
      args.code,
    );
    if (exists) return false;
    insert(
      `INSERT INTO benefits
        (card_product_id, code, name, category, description, reward_type, reward_value, reward_points, point_value_inr,
         threshold_amount, min_eligible_spend, calc_method, include_all, eligible_categories, excluded_categories,
         cap_amount, cap_points, period_type, period_start_rule, requires_anniversary, requires_activation,
         effective_from, effective_until, redemption_instructions, expiry_rules, source_url, source_label,
         verified_at, confidence, status, version)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      product.id,
      args.code,
      args.name,
      args.category,
      args.description,
      args.rewardType,
      args.rewardValue ?? null,
      null,
      args.pointValueInr ?? null,
      null,
      null,
      args.calcMethod,
      args.includeAll ? 1 : 0,
      args.eligibleCategories ? JSON.stringify(args.eligibleCategories) : null,
      args.excludedCategories ? JSON.stringify(args.excludedCategories) : null,
      args.capAmount ?? null,
      null,
      args.periodType,
      null,
      0,
      0,
      null,
      null,
      null,
      null,
      card.url,
      CARDADVISOR_ATTRIBUTION,
      null,
      'medium',
      'active',
      1,
    );
    benefits++;
    return true;
  };

  for (const r of card.rewards) {
    seq++;
    const category = CATEGORY_MAP[r.category] ?? 'base';
    const rewardType = REWARD_TYPE_MAP[r.rewardType] ?? 'reward_points';
    const isDefault = r.category === 'DEFAULT';
    const scope = r.merchants ? ` (scope: ${r.merchants})` : '';
    insertBenefit({
      code: `CA-${card.cardKey}-R${seq}`,
      name: `${isDefault ? 'Base' : (r.category.replace(/_/g, ' ').toLowerCase())} — ${r.rewardType} earn${scope}`,
      category,
      description:
        `Effective return ${r.ratePct ?? '—'}% of spend` +
        (r.pointValuePaisa != null ? `, point value ${r.pointValuePaisa / 100}₹` : '') +
        (r.monthlyCapRs != null ? `, monthly cap ₹${r.monthlyCapRs}` : '') +
        `. Imported from CardAdvisor.`,
      rewardType,
      calcMethod: calcForReward(r.rewardType),
      rewardValue: r.ratePct ?? null,
      pointValueInr: r.pointValuePaisa != null ? r.pointValuePaisa / 100 : null,
      capAmount: r.monthlyCapRs ?? null,
      includeAll: isDefault,
      eligibleCategories: isDefault ? null : [category],
      excludedCategories: null,
      periodType: 'monthly',
    });
  }

  for (const p of card.perks) {
    seq++;
    const mapped = PERK_CATEGORY_MAP[p.perkType] ?? { category: 'other', rewardType: 'discount' };
    insertBenefit({
      code: `CA-${card.cardKey}-P${seq}`,
      name: p.perkType.replace(/_/g, ' ').toLowerCase(),
      category: mapped.category,
      description: `Perk: ${p.perkType}. Imported from CardAdvisor.`,
      rewardType: mapped.rewardType,
      calcMethod: mapped.rewardType === 'fee_waiver' ? 'fee_waiver' : 'percentage_capped',
      rewardValue: null,
      pointValueInr: null,
      capAmount: null,
      includeAll: false,
      eligibleCategories: null,
      excludedCategories: null,
      periodType: 'anniversary_year',
    });
  }

  return { productId: product.id, benefits, created };
}

export function importDataset(dataset: CardAdvisorDataset): ImportResult {
  let cards = 0;
  let benefits = 0;
  let skipped = 0;
  for (const card of dataset.cards) {
    try {
      const r = importCard(card);
      if (r.created) cards++;
      benefits += r.benefits;
    } catch {
      skipped++;
    }
  }

  const sourceUrl = dataset.cards.length ? 'https://cardadvisor.in/data/cards.json' : '';
  if (sourceUrl) {
    const existing = get<{ id: number }>('SELECT id FROM sources WHERE url = ?', sourceUrl);
    if (!existing) {
      insert(
        'INSERT INTO sources (name, url, kind, status, notes) VALUES (?,?,?,?,?)',
        'CardAdvisor datasets',
        sourceUrl,
        'api',
        'ok',
        `Imported ${cards} cards, ${benefits} benefits. ${CARDADVISOR_ATTRIBUTION}`,
      );
    } else {
      run('UPDATE sources SET status = ?, notes = ? WHERE id = ?', 'ok', `Imported ${cards} cards, ${benefits} benefits.`, existing.id);
    }
  }

  return {
    cards,
    benefits,
    skipped,
    asOf: dataset.asOf ?? null,
    version: dataset.version ?? null,
    attribution: CARDADVISOR_ATTRIBUTION,
  };
}

/** Fetch the live dataset and import it. */
export async function importFromCardAdvisor(url?: string): Promise<ImportResult> {
  const dataset = await fetchDataset(url);
  return importDataset(dataset);
}

export type { CardAdvisorDataset };
export { fetchMeta };
