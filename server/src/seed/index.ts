import { db, get, insert } from '../db.ts';
import { SEED_CARDS, SEED_SOURCES } from './cards.ts';
import { DEFAULT_RULES } from '../categorize/categorizer.ts';

export const DEFAULT_PROFILE_NAME = 'Local User';

function jsonOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  return JSON.stringify(v);
}

export function ensureDefaultProfile(): number {
  const existing = get<{ id: number }>('SELECT id FROM profiles ORDER BY id LIMIT 1');
  if (existing) return existing.id;
  return insert('INSERT INTO profiles (name) VALUES (?)', DEFAULT_PROFILE_NAME);
}

export function seedCatalog(): { cards: number; benefits: number } {
  let cards = 0;
  let benefits = 0;
  for (const card of SEED_CARDS) {
    const issuer =
      get<{ id: number }>('SELECT id FROM issuers WHERE slug = ?', card.issuerSlug) ??
      (() => {
        const id = insert('INSERT INTO issuers (name, slug) VALUES (?, ?)', card.issuer, card.issuerSlug);
        return { id };
      })();

    let product = get<{ id: number }>('SELECT id FROM card_products WHERE slug = ?', card.slug);
    if (!product) {
      const id = insert(
        `INSERT INTO card_products
          (issuer_id, slug, name, variant, network, tier, annual_fee, fee_waiver_spend, fee_waiver_period,
           reward_program, official_url, data_confidence, verification_status, verified_at, notes)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        issuer.id,
        card.slug,
        card.name,
        card.variant ?? null,
        card.network ?? null,
        card.tier,
        card.annualFee ?? null,
        card.feeWaiverSpend ?? null,
        card.feeWaiverPeriod ?? null,
        card.rewardProgram ?? null,
        card.officialUrl,
        card.dataConfidence,
        card.verificationStatus,
        card.verifiedAt ?? null,
        card.notes ?? null,
      );
      product = { id };
      cards++;
    }

    for (const b of card.benefits) {
      const existing = get<{ id: number }>(
        'SELECT id FROM benefits WHERE card_product_id = ? AND code = ? AND version = 1',
        product.id,
        b.code,
      );
      if (existing) continue;
      insert(
        `INSERT INTO benefits
          (card_product_id, code, name, category, description, reward_type, reward_value, reward_points, point_value_inr,
           threshold_amount, min_eligible_spend, calc_method, include_all, eligible_categories, excluded_categories,
           cap_amount, cap_points, period_type, period_start_rule, requires_anniversary, requires_activation,
           effective_from, effective_until, redemption_instructions, expiry_rules, source_url, source_label,
           verified_at, confidence, status, version)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        product.id,
        b.code,
        b.name,
        b.category,
        b.description,
        b.rewardType,
        b.rewardValue ?? null,
        b.rewardPoints ?? null,
        b.pointValueInr ?? null,
        b.thresholdAmount ?? null,
        b.minEligibleSpend ?? null,
        b.calcMethod,
        b.includeAll ? 1 : 0,
        jsonOrNull(b.eligibleCategories),
        jsonOrNull(b.excludedCategories),
        b.capAmount ?? null,
        b.capPoints ?? null,
        b.periodType,
        null,
        b.requiresAnniversary ? 1 : 0,
        b.requiresActivation ? 1 : 0,
        b.effectiveFrom ?? null,
        b.effectiveUntil ?? null,
        b.redemptionInstructions ?? null,
        b.expiryRules ?? null,
        b.sourceUrl,
        b.sourceLabel,
        null,
        b.confidence,
        'active',
        1,
      );
      benefits++;
    }
  }

  for (const s of SEED_SOURCES) {
    const existing = get<{ id: number }>('SELECT id FROM sources WHERE url = ?', s.url);
    if (existing) continue;
    insert(
      'INSERT INTO sources (name, url, kind, issuer_slug, status, notes) VALUES (?,?,?,?,?,?)',
      s.name,
      s.url,
      s.kind,
      s.issuerSlug ?? null,
      s.status ?? 'known',
      s.notes ?? null,
    );
  }

  return { cards, benefits };
}

export function seedMerchantRules(): number {
  const count = get<{ c: number }>('SELECT COUNT(*) AS c FROM merchant_rules')?.c ?? 0;
  if (count > 0) return 0;
  let n = 0;
  for (const r of DEFAULT_RULES) {
    insert('INSERT INTO merchant_rules (pattern, match_type, category, priority) VALUES (?,?,?,?)', r.pattern, 'substring', r.category, r.priority);
    n++;
  }
  return n;
}

export function emptyUserData(): { cards: number; transactions: number } {
  const c = get<{ c: number }>('SELECT COUNT(*) AS c FROM user_cards')?.c ?? 0;
  const t = get<{ c: number }>('SELECT COUNT(*) AS c FROM transactions')?.c ?? 0;
  return { cards: c, transactions: t };
}

export function resetUserData() {
  db.exec(
    'DELETE FROM transactions; DELETE FROM statements; DELETE FROM pending_imports; DELETE FROM user_overrides; DELETE FROM reward_events; DELETE FROM user_cards;',
  );
}
