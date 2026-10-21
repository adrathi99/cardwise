import { config } from '../config.ts';

/**
 * CardAdvisor (https://cardadvisor.in) client.
 *
 * Two surfaces are used:
 *   - The bulk open dataset at /data/cards.json (CC BY 4.0, no key, facts only).
 *   - The public API at /api/public/v1 (anonymous facts tier, or richer "stated"
 *     view with a key). Every card key is in the bulk dataset; there is no card
 *     list endpoint, so the dataset is the enumeration source.
 *
 * Attribution is required by the dataset licence (CC BY 4.0).
 */

export const CARDADVISOR_ATTRIBUTION = 'CardAdvisor — India Credit Card Facts (CC BY 4.0, cardadvisor.in)';

export interface CardAdvisorReward {
  category: string;
  rewardType: string;
  /** Effective return in percent (e.g. 0.5 = 0.5%). */
  ratePct: number | null;
  /** Stated view only: points earned per rupee of spend (e.g. 0.02 = 2 points per ₹100). */
  rewardRate?: number | null;
  monthlyCapRs: number | null;
  pointValuePaisa: number | null;
  merchants: string | null;
}

export interface CardAdvisorPerk {
  perkType: string;
  /** Stated view only: structured spend gate when CardAdvisor has one. */
  spendThresholdRs?: number | null;
  domestic?: boolean;
  international?: boolean;
  visitsPerQuarter?: number | null;
  description?: string;
}

export interface CardAdvisorCard {
  cardKey: string;
  name: string;
  issuer: string;
  network: string | null;
  tier: string | null;
  annualFeeRs: number | null;
  joiningFeeRs: number | null;
  lifetimeFree: boolean;
  feeWaiverSpendRs: number | null;
  forexMarkupPct: number | null;
  aprMonthlyPct: number | null;
  minSalaryRs: number | null;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  rewardRateMinPct: number | null;
  rewardRateMaxPct: number | null;
  lastVerified: string | null;
  url: string;
  rewards: CardAdvisorReward[];
  perks: CardAdvisorPerk[];
}

export interface CardAdvisorDataset {
  dataset: string;
  asOf: string | null;
  version: string | null;
  cardCount: number;
  cards: CardAdvisorCard[];
}

const USER_AGENT = 'CARDWISE/0.1 (cardadvisor-import)';

async function fetchJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: 'application/json' };
  if (config.cardadvisor.apiKey) headers.authorization = `Bearer ${config.cardadvisor.apiKey}`;
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers });
    if (!res.ok) throw new Error(`CardAdvisor request failed: HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the full open dataset. Anonymous, no key required. */
export async function fetchDataset(url = config.cardadvisor.datasetUrl): Promise<CardAdvisorDataset> {
  const raw = await fetchJson<CardAdvisorDataset>(url);
  if (!raw || !Array.isArray(raw.cards)) throw new Error(`CardAdvisor dataset at ${url} has an unexpected shape`);
  return raw;
}

export interface CardAdvisorMeta {
  api: { version: string; schemaVersion: number; docs: string; openapi: string };
  you: { tier: 'anonymous' | 'keyed'; view?: string; limits: Record<string, number>; remainingInWindow: number; windowResets: number };
  openDataset: { latestRelease: { version: string; url: string } | null; licence: string };
}

/** Query the API meta endpoint (works anonymously; richer with a key). */
export async function fetchMeta(base = config.cardadvisor.apiBase): Promise<CardAdvisorMeta> {
  const raw = await fetchJson<{ success: boolean; data: CardAdvisorMeta }>(`${base}/meta`);
  if (!raw?.data) throw new Error('CardAdvisor /meta returned no data');
  return raw.data;
}

export interface CardAdvisorStatedFees {
  joiningFeeRs?: number | null;
  annualFeeRs?: number | null;
  feeWaiverSpendRs?: number | null;
  lifetimeFree?: boolean;
  forexMarkupPct?: number | null;
  aprMonthlyPct?: number | null;
  [key: string]: unknown;
}

export interface CardAdvisorStatedReward extends CardAdvisorReward {
  note?: string | null;
}

export interface CardAdvisorStatedCard {
  cardKey: string;
  name: string;
  issuer: string;
  network: string | null;
  tier: string | null;
  fees?: CardAdvisorStatedFees;
  eligibility?: Record<string, unknown>;
  rewards?: CardAdvisorStatedReward[];
  excludedCategories?: string[];
  perks: CardAdvisorPerk[];
  lastVerified?: string | null;
  url?: string;
  [key: string]: unknown;
}

/** Fetch a single card's facts (or stated view when a key is configured). */
export async function fetchCard(cardKey: string, base = config.cardadvisor.apiBase): Promise<CardAdvisorStatedCard> {
  const raw = await fetchJson<{ success: boolean; data: { view: string; card: CardAdvisorStatedCard } }>(
    `${base}/cards/${encodeURIComponent(cardKey)}`,
  );
  if (!raw?.data?.card) throw new Error(`CardAdvisor /cards/${cardKey} returned no card`);
  return raw.data.card;
}
