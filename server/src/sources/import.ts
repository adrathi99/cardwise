import { all, get, insert, run } from '../db.ts';
import {
  CARDADVISOR_ATTRIBUTION,
  fetchCard,
  fetchDataset,
  fetchMeta,
  type CardAdvisorCard,
  type CardAdvisorDataset,
  type CardAdvisorPerk,
  type CardAdvisorReward,
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

/**
 * Points earned per ₹100 of spend. The dataset only has the effective return
 * (ratePct) and the point value; the stated view also has rewardRate.
 */
export function pointsPerHundred(r: Pick<CardAdvisorReward, 'rewardRate' | 'ratePct' | 'pointValuePaisa'>): number | null {
  if (r.rewardRate != null && r.rewardRate > 0) return Math.round(r.rewardRate * 10000) / 100;
  if (r.ratePct != null && r.pointValuePaisa != null && r.pointValuePaisa > 0) {
    return Math.round((r.ratePct / (r.pointValuePaisa / 100)) * 100) / 100;
  }
  return null;
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
      rewardValue: calcForReward(r.rewardType) === 'points_per_100' ? pointsPerHundred(r) : (r.ratePct ?? null),
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

/* -------------------------------------------------------------------------- */
/* Stated-view enrichment                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The open dataset only carries perk types and bare rate rows. The keyed
 * "stated" view adds prose terms, structured gates, visit counts, geography
 * flags, earning exclusions, notes per reward row, and refreshed fees. This
 * pass folds all of that into the card and its imported benefits, so the
 * benefits engine can show real thresholds and honest descriptions for every
 * benefit (not just perks).
 */

export interface PerkGate {
  amount: number;
  periodType: 'quarterly' | 'monthly' | 'anniversary_year' | null;
}

const GATE_RE =
  /(?:gated behind|requires?|needs?|after|unlocked by(?:\s+spending)?|on spending)\s*₹\s*([\d,]+(?:\.\d+)?)\s*(lakh|crore|l|k)?([^.;)]{0,80})/i;

/** Fallback for gates phrased as "₹1 lakh of spend in the previous quarter". */
const SPEND_GATE_RE = /₹\s*([\d,]+(?:\.\d+)?)\s*(lakh|crore|l|k)?\s*(?:of\s+)?(?:[a-z]+\s+)?spend\b([^.;)]{0,60})/i;

/** Pull a spend gate like "gated behind ₹75,000/quarter spend" out of a perk description. */
export function parsePerkGate(description: string): PerkGate | null {
  const verbMatch = GATE_RE.exec(description);
  const m = verbMatch ?? SPEND_GATE_RE.exec(description);
  if (!m) return null;
  const amount = Number((m[1] ?? '').replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = (m[2] ?? '').toLowerCase();
  const multiplier = unit === 'crore' ? 1e7 : unit === 'lakh' || unit === 'l' ? 1e5 : unit === 'k' ? 1e3 : 1;
  const tail = m[3] ?? '';
  const periodType = /quarter/i.test(tail)
    ? 'quarterly'
    : /\bmonthly\b|\bper month\b|\bmonth\b/i.test(tail)
      ? 'monthly'
      : /annual|\byear\b|\bper year\b/i.test(tail)
        ? 'anniversary_year'
        : null;
  // Without an explicit gate verb, only trust an amount tied to a cadence.
  if (!verbMatch && periodType == null) return null;
  return { amount: Math.round(amount * multiplier), periodType };
}

function perkKey(perkType: string): string {
  return perkType.toLowerCase().replace(/_/g, ' ').trim();
}

function perkDescription(p: CardAdvisorPerk): string {
  const base = p.description ?? `Perk: ${p.perkType}.`;
  const meta: string[] = [];
  if (p.visitsPerQuarter != null) meta.push(`${p.visitsPerQuarter} visit(s) per quarter`);
  if (p.domestic && p.international) meta.push('domestic & international');
  else if (p.domestic) meta.push('domestic only');
  else if (p.international) meta.push('international only');
  return meta.length ? `${base} [${meta.join('; ')}]` : base;
}

export interface EnrichResult {
  cards: number;
  perks: number;
  rewards: number;
  gated: number;
  skipped: number;
  errors: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statedCategory(category: string): string {
  if (category === 'DEFAULT') return 'base';
  return CATEGORY_MAP[category] ?? category.toLowerCase();
}

/** Enrich imported cards and their benefits using the keyed stated view. One call per card. */
export async function enrichFromStatedView(
  opts: { sleepMs?: number; limit?: number; offset?: number; onProgress?: (done: number, total: number, slug: string) => void } = {},
): Promise<EnrichResult> {
  const sleepMs = opts.sleepMs ?? 1100;
  const cards = all<{ id: number; slug: string }>(
    `SELECT DISTINCT p.id, p.slug
       FROM card_products p
       JOIN benefits b ON b.card_product_id = p.id
      WHERE b.code LIKE 'CA-%' AND p.is_custom = 0
      ORDER BY p.id`,
  );
  const from = opts.offset ?? 0;
  const targets = cards.slice(from, opts.limit ? from + opts.limit : undefined);
  const result: EnrichResult = { cards: 0, perks: 0, rewards: 0, gated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < targets.length; i++) {
    const card = targets[i]!;
    try {
      const stated = await fetchCard(card.slug);

      // Card-level facts (fees, tier, network, source freshness).
      const fees = stated.fees ?? {};
      run(
        `UPDATE card_products
            SET annual_fee = COALESCE(?, annual_fee),
                fee_waiver_spend = COALESCE(?, fee_waiver_spend),
                fee_waiver_period = CASE WHEN ? IS NOT NULL THEN 'anniversary_year' ELSE fee_waiver_period END,
                network = COALESCE(?, network),
                tier = COALESCE(?, tier),
                official_url = COALESCE(?, official_url),
                verified_at = COALESCE(?, verified_at),
                notes = ?
          WHERE id = ?`,
        fees.annualFeeRs ?? null,
        fees.feeWaiverSpendRs ?? null,
        fees.feeWaiverSpendRs ?? null,
        stated.network ?? null,
        TIER_MAP[stated.tier ?? ''] ?? null,
        stated.url ?? null,
        stated.lastVerified ?? null,
        `Enriched from CardAdvisor stated view. ${CARDADVISOR_ATTRIBUTION}`,
        card.id,
      );

      // Earning exclusions apply to include-all (base) reward rows.
      const excluded = (stated.excludedCategories ?? []).map(statedCategory);
      const excludedJson = excluded.length ? JSON.stringify(excluded) : null;
      const rewardRows = all<{ id: number; category: string; include_all: number; calc_method: string }>(
        "SELECT id, category, include_all, calc_method FROM benefits WHERE card_product_id = ? AND code LIKE 'CA-%-R%'",
        card.id,
      );

      for (const r of stated.rewards ?? []) {
        const category = statedCategory(r.category);
        const isDefault = r.category === 'DEFAULT';
        const row =
          rewardRows.find((x) => x.category === category && (!isDefault || x.include_all === 1)) ??
          rewardRows.find((x) => x.category === category);
        if (!row) continue;
        const rewardValue = row.calc_method === 'points_per_100' ? pointsPerHundred(r) : (r.ratePct ?? null);
        run(
          `UPDATE benefits
              SET description = COALESCE(NULLIF(?, ''), description),
                  reward_value = COALESCE(?, reward_value),
                  point_value_inr = COALESCE(?, point_value_inr),
                  cap_amount = COALESCE(?, cap_amount),
                  excluded_categories = COALESCE(?, excluded_categories)
            WHERE id = ?`,
          r.note ?? '',
          rewardValue,
          r.pointValuePaisa != null ? r.pointValuePaisa / 100 : null,
          r.monthlyCapRs ?? null,
          row.include_all === 1 ? excludedJson : null,
          row.id,
        );
        result.rewards++;
      }

      // Perk terms, gates and cadence. A card can repeat a perk type, so queue rows.
      const perkRows = all<{ id: number; name: string }>(
        "SELECT id, name FROM benefits WHERE card_product_id = ? AND code LIKE 'CA-%-P%' ORDER BY id",
        card.id,
      );
      const byName = new Map<string, { id: number; name: string }[]>();
      for (const r of perkRows) {
        const key = r.name.trim().toLowerCase();
        const list = byName.get(key);
        if (list) list.push(r);
        else byName.set(key, [r]);
      }

      for (const perk of stated.perks ?? []) {
        if (perk.description == null && perk.spendThresholdRs == null) continue;
        const row = byName.get(perkKey(perk.perkType))?.shift();
        if (!row) continue;
        const structured = perk.spendThresholdRs != null && perk.spendThresholdRs > 0 ? perk.spendThresholdRs : null;
        // The stated description carries the cadence ("₹1.5 lakh a quarter"),
        // while spendThresholdRs is often an annual roll-up. Prefer the
        // description when it names a period so progress is tracked per gate.
        const gate = perk.description ? parsePerkGate(perk.description) : null;
        const threshold = gate?.amount ?? structured ?? null;
        run(
          `UPDATE benefits
              SET description = ?,
                  threshold_amount = COALESCE(?, threshold_amount),
                  period_type = COALESCE(?, period_type),
                  include_all = CASE WHEN ? IS NOT NULL THEN 1 ELSE include_all END
            WHERE id = ?`,
          perkDescription(perk),
          threshold,
          gate?.periodType ?? null,
          threshold,
          row.id,
        );
        result.perks++;
        if (threshold != null) result.gated++;
      }
      result.cards++;
    } catch (e) {
      result.skipped++;
      result.errors.push(`${card.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
    opts.onProgress?.(i + 1, targets.length, card.slug);
    if (i < targets.length - 1) await sleep(sleepMs);
  }

  return result;
}
