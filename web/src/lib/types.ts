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

export interface BenefitRow {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string | null;
  reward_type: string;
  reward_value: number | null;
  reward_points: number | null;
  point_value_inr: number | null;
  threshold_amount: number | null;
  calc_method: string;
  include_all: number;
  eligible_categories: string | null;
  excluded_categories: string | null;
  cap_amount: number | null;
  period_type: string;
  requires_anniversary: number;
  requires_activation: number;
  redemption_instructions: string | null;
  expiry_rules: string | null;
  source_url: string | null;
  source_label: string | null;
  confidence: string;
  status: string;
}

export interface UserCard {
  id: number;
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
  period: { type: string; start: string; end: string; label: string; nextReset: string; basedOnAnniversary: boolean };
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
  status: string;
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

export interface CardAnalytics {
  card: UserCard;
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

export interface Overview {
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
  overview: Overview;
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

export interface Transaction {
  id: number;
  userCardId: number;
  txnDate: string;
  description: string;
  merchant: string;
  amount: number;
  direction: 'debit' | 'credit';
  txnType: string;
  category: string;
  categorySource: string;
  confidence: number;
  isExcluded: number;
  exclusionReason: string | null;
  sourceFile: string;
  cardNickname: string;
  cardName: string;
  cardProductId: number;
  eligibleFor: string[];
  spendEligible: boolean;
}

export interface Statement {
  id: number;
  user_card_id: number;
  filename: string;
  statement_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  parse_confidence: number;
  imported_count: number;
  duplicate_count: number;
  skipped_count: number;
  cardNickname: string;
  cardName: string;
  created_at: string;
}

export interface StagedTxn {
  txn_date: string;
  description: string;
  merchant: string;
  amount: number;
  direction: 'debit' | 'credit';
  txn_type: string;
  category: string;
  category_source: string;
  confidence: number;
  is_excluded: number;
  exclusion_reason: string | null;
  isDuplicate: boolean;
}

export interface PendingImport {
  pendingId: number;
  fileName: string;
  statementDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  parseConfidence: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  warnings: string[];
  likelyScanned: boolean;
  transactions: StagedTxn[];
}
