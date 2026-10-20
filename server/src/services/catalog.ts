import { all, get } from '../db.ts';

export interface CatalogCard {
  id: number;
  slug: string;
  name: string;
  variant: string | null;
  network: string | null;
  tier: string;
  annualFee: number | null;
  rewardProgram: string | null;
  officialUrl: string | null;
  dataConfidence: string;
  verificationStatus: string;
  notes: string | null;
  issuerId: number;
  issuer: string;
  issuerSlug: string;
  benefitCount: number;
}

export function listCatalog(opts: { search?: string; issuer?: string; tier?: string } = {}): CatalogCard[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.search) {
    where.push('(cp.name LIKE ? OR cp.variant LIKE ? OR i.name LIKE ?)');
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  if (opts.issuer) {
    where.push('i.slug = ?');
    params.push(opts.issuer);
  }
  if (opts.tier) {
    where.push('cp.tier = ?');
    params.push(opts.tier);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return all<CatalogCard>(`
    SELECT cp.id AS id, cp.slug AS slug, cp.name AS name, cp.variant AS variant, cp.network AS network,
           cp.tier AS tier, cp.annual_fee AS annualFee, cp.reward_program AS rewardProgram,
           cp.official_url AS officialUrl, cp.data_confidence AS dataConfidence,
           cp.verification_status AS verificationStatus, cp.notes AS notes,
           i.id AS issuerId, i.name AS issuer, i.slug AS issuerSlug,
           (SELECT COUNT(*) FROM benefits b WHERE b.card_product_id = cp.id AND b.status='active') AS benefitCount
    FROM card_products cp
    JOIN issuers i ON i.id = cp.issuer_id
    ${clause}
    ORDER BY i.name, cp.name
  `, ...params);
}

export function listIssuers(): { id: number; name: string; slug: string; cardCount: number }[] {
  return all(`
    SELECT i.id AS id, i.name AS name, i.slug AS slug,
           (SELECT COUNT(*) FROM card_products cp WHERE cp.issuer_id = i.id) AS cardCount
    FROM issuers i ORDER BY i.name
  `);
}

export function getCatalogCard(id: number) {
  const card = get<CatalogCard>(`
    SELECT cp.id AS id, cp.slug AS slug, cp.name AS name, cp.variant AS variant, cp.network AS network,
           cp.tier AS tier, cp.annual_fee AS annualFee, cp.reward_program AS rewardProgram,
           cp.official_url AS officialUrl, cp.data_confidence AS dataConfidence,
           cp.verification_status AS verificationStatus, cp.notes AS notes,
           i.id AS issuerId, i.name AS issuer, i.slug AS issuerSlug,
           (SELECT COUNT(*) FROM benefits b WHERE b.card_product_id = cp.id AND b.status='active') AS benefitCount
    FROM card_products cp JOIN issuers i ON i.id = cp.issuer_id WHERE cp.id = ?
  `, id);
  if (!card) return null;
  const benefits = all(
    `SELECT * FROM benefits b WHERE b.card_product_id = ? AND b.status='active'
       AND b.version = (SELECT MAX(version) FROM benefits b2 WHERE b2.card_product_id=b.card_product_id AND b2.code=b.code)
     ORDER BY b.id`,
    id,
  );
  return { card, benefits };
}
