/**
 * CARDWISE card catalog seed.
 *
 * IMPORTANT — DATA HONESTY:
 * Every benefit below carries a `confidence` and `verificationStatus`. None of
 * these rows have been machine-verified against the issuer at build time, so
 * they are seeded as `unverified` / `indicative`. Each row links to the
 * official issuer page so a reviewer can confirm it. The UI surfaces this
 * status everywhere benefit values are shown.
 *
 * Eligibility is modelled at CATEGORY level. Several real benefits (e.g. "5%
 * on 10 select merchants") are merchant-specific; those are approximated by
 * category and flagged in the description/notes. This is a documented V1
 * limitation.
 */

export interface SeedBenefit {
  code: string;
  name: string;
  category: string;
  description: string;
  rewardType: 'cashback' | 'reward_points' | 'voucher' | 'fee_waiver' | 'lounge' | 'discount';
  rewardValue?: number;
  rewardPoints?: number;
  pointValueInr?: number;
  thresholdAmount?: number;
  minEligibleSpend?: number;
  calcMethod: 'milestone' | 'cashback_percent' | 'points_per_100' | 'percentage_capped' | 'fee_waiver';
  includeAll?: boolean;
  eligibleCategories?: string[];
  excludedCategories?: string[];
  capAmount?: number;
  capPoints?: number;
  periodType: 'calendar_year' | 'financial_year' | 'anniversary_year' | 'monthly' | 'quarterly' | 'rolling_12m';
  requiresAnniversary?: boolean;
  requiresActivation?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
  redemptionInstructions?: string;
  expiryRules?: string;
  sourceUrl: string;
  sourceLabel: string;
  confidence: 'high' | 'medium' | 'indicative' | 'unverified';
}

export interface SeedCard {
  issuer: string;
  issuerSlug: string;
  slug: string;
  name: string;
  variant?: string;
  network?: string;
  tier: 'entry' | 'mid' | 'premium' | 'super_premium' | 'secured';
  annualFee?: number;
  feeWaiverSpend?: number;
  feeWaiverPeriod?: string;
  rewardProgram?: string;
  officialUrl: string;
  dataConfidence: 'high' | 'medium' | 'indicative' | 'unverified';
  verificationStatus: 'unverified';
  verifiedAt?: string;
  notes?: string;
  benefits: SeedBenefit[];
}

const COMMON_EXCLUSIONS = ['fuel', 'wallet', 'emi', 'fees_interest', 'taxes', 'government', 'cashback', 'payments'];

export const SEED_CARDS: SeedCard[] = [
  {
    issuer: 'ICICI Bank',
    issuerSlug: 'icici',
    slug: 'icici-amazon-pay',
    name: 'Amazon Pay Credit Card',
    variant: 'Amazon Pay',
    network: 'Visa',
    tier: 'entry',
    annualFee: 0,
    rewardProgram: 'Amazon Pay Rewards',
    officialUrl: 'https://www.icicibank.com/card/credit-cards/amazon-pay-credit-card',
    dataConfidence: 'medium',
    verificationStatus: 'unverified',
    notes: 'Cashback tiers differ for Prime vs non-Prime on amazon.in. Merchant-specific terms are approximated by category in V1.',
    benefits: [
      {
        code: 'AP-AMAZON-5',
        name: '5% cashback on Amazon.in (Prime)',
        category: 'online_shopping',
        description: 'Up to 5% cashback on amazon.in purchases for Amazon Prime members. Merchant-specific; approximated here by the online-shopping category.',
        rewardType: 'cashback',
        rewardValue: 5,
        calcMethod: 'cashback_percent',
        eligibleCategories: ['online_shopping'],
        capAmount: 2000,
        periodType: 'monthly',
        sourceUrl: 'https://www.icicibank.com/card/credit-cards/amazon-pay-credit-card',
        sourceLabel: 'ICICI Bank — Amazon Pay Card',
        confidence: 'indicative',
        redemptionInstructions: 'Cashback credited to the Amazon Pay balance / statement as per issuer terms.',
      },
      {
        code: 'AP-AMAZONPAY-2',
        name: '2% back on Amazon Pay bills & utilities',
        category: 'utilities',
        description: '2% rewards on Amazon Pay bill payments and recharges.',
        rewardType: 'cashback',
        rewardValue: 2,
        calcMethod: 'cashback_percent',
        eligibleCategories: ['utilities', 'telecom'],
        periodType: 'monthly',
        sourceUrl: 'https://www.icicibank.com/card/credit-cards/amazon-pay-credit-card',
        sourceLabel: 'ICICI Bank — Amazon Pay Card',
        confidence: 'indicative',
      },
      {
        code: 'AP-BASE-1',
        name: '1% back on all other spends',
        category: 'base',
        description: '1% cashback on all spends other than the accelerated categories.',
        rewardType: 'cashback',
        rewardValue: 1,
        calcMethod: 'cashback_percent',
        includeAll: true,
        excludedCategories: [...COMMON_EXCLUSIONS, 'online_shopping', 'utilities', 'telecom'],
        periodType: 'monthly',
        sourceUrl: 'https://www.icicibank.com/card/credit-cards/amazon-pay-credit-card',
        sourceLabel: 'ICICI Bank — Amazon Pay Card',
        confidence: 'indicative',
      },
    ],
  },
  {
    issuer: 'HDFC Bank',
    issuerSlug: 'hdfc',
    slug: 'hdfc-millennia',
    name: 'Millennia Credit Card',
    variant: 'Millennia',
    network: 'Visa',
    tier: 'mid',
    annualFee: 1000,
    feeWaiverSpend: 100000,
    feeWaiverPeriod: 'anniversary_year',
    rewardProgram: 'HDFC CashBack',
    officialUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card',
    dataConfidence: 'medium',
    verificationStatus: 'unverified',
    notes: '5% applies to a specific list of merchants (Amazon, Flipkart, Myntra, Swiggy, etc.), approximated by category here.',
    benefits: [
      {
        code: 'MIL-SELECT-5',
        name: '5% cashback on select merchants',
        category: 'online_shopping',
        description: '5% cashback on a list of partner merchants (Amazon, Flipkart, Myntra, Swiggy, Zomato, Uber, etc.). Approximated by category.',
        rewardType: 'cashback',
        rewardValue: 5,
        calcMethod: 'cashback_percent',
        eligibleCategories: ['online_shopping', 'dining'],
        capAmount: 1000,
        periodType: 'monthly',
        sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card',
        sourceLabel: 'HDFC Bank — Millennia',
        confidence: 'indicative',
        redemptionInstructions: 'Cashback is adjusted in the next billing cycle statement.',
      },
      {
        code: 'MIL-BASE-1',
        name: '1% cashback on other spends',
        category: 'base',
        description: '1% cashback on all other eligible spends, capped monthly.',
        rewardType: 'cashback',
        rewardValue: 1,
        calcMethod: 'cashback_percent',
        includeAll: true,
        excludedCategories: [...COMMON_EXCLUSIONS, 'online_shopping', 'dining'],
        capAmount: 1000,
        periodType: 'monthly',
        sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card',
        sourceLabel: 'HDFC Bank — Millennia',
        confidence: 'indicative',
        redemptionInstructions: 'Cashback is adjusted in the next billing cycle statement.',
      },
      {
        code: 'MIL-FEE-WAIVER',
        name: 'Annual fee waiver on ₹1,00,000 spend',
        category: 'fee_waiver',
        description: 'Annual fee waived if total spends in the card membership year reach ₹1,00,000.',
        rewardType: 'fee_waiver',
        rewardValue: 1000,
        thresholdAmount: 100000,
        calcMethod: 'fee_waiver',
        includeAll: true,
        excludedCategories: COMMON_EXCLUSIONS,
        periodType: 'anniversary_year',
        requiresAnniversary: true,
        sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card',
        sourceLabel: 'HDFC Bank — Millennia',
        confidence: 'indicative',
        expiryRules: 'Evaluated on the card membership anniversary year.',
      },
    ],
  },
  {
    issuer: 'Axis Bank',
    issuerSlug: 'axis',
    slug: 'axis-ace',
    name: 'ACE Credit Card',
    variant: 'ACE',
    network: 'Visa',
    tier: 'entry',
    annualFee: 0,
    rewardProgram: 'Axis EDGE Rewards (cashback)',
    officialUrl: 'https://www.axisbank.com/retail/cards/credit-card/ace-credit-card',
    dataConfidence: 'indicative',
    verificationStatus: 'unverified',
    notes: 'Accelerated cashback applies on bill payments/recharges via a specific platform. Approximated by category.',
    benefits: [
      {
        code: 'ACE-UTIL-5',
        name: '5% cashback on bill payments & recharges',
        category: 'utilities',
        description: '5% cashback on utility bills and mobile recharges made via the eligible platform.',
        rewardType: 'cashback',
        rewardValue: 5,
        calcMethod: 'cashback_percent',
        eligibleCategories: ['utilities', 'telecom'],
        capAmount: 500,
        periodType: 'monthly',
        sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/ace-credit-card',
        sourceLabel: 'Axis Bank — ACE',
        confidence: 'indicative',
        redemptionInstructions: 'Cashback credited to the card statement in the following cycle.',
      },
      {
        code: 'ACE-BASE-2',
        name: '2% cashback on all other spends',
        category: 'base',
        description: '2% cashback on all other eligible spends.',
        rewardType: 'cashback',
        rewardValue: 2,
        calcMethod: 'cashback_percent',
        includeAll: true,
        excludedCategories: [...COMMON_EXCLUSIONS, 'utilities', 'telecom'],
        periodType: 'monthly',
        sourceUrl: 'https://www.axisbank.com/retail/cards/credit-card/ace-credit-card',
        sourceLabel: 'Axis Bank — ACE',
        confidence: 'indicative',
      },
    ],
  },
  {
    issuer: 'SBI Card',
    issuerSlug: 'sbicard',
    slug: 'sbi-simplyclick',
    name: 'SimplyCLICK SBI Card',
    variant: 'SimplyCLICK',
    network: 'Visa',
    tier: 'entry',
    annualFee: 499,
    feeWaiverSpend: 100000,
    feeWaiverPeriod: 'anniversary_year',
    rewardProgram: 'SBI Reward Points',
    officialUrl: 'https://www.sbicard.com/en/personal/credit-cards/simplyclick-sbi-card.page',
    dataConfidence: 'medium',
    verificationStatus: 'unverified',
    notes: 'Accelerated reward points apply for online spends with partner merchants.',
    benefits: [
      {
        code: 'SC-ONLINE-10X',
        name: '10X reward points on online spends',
        category: 'online_shopping',
        description: '10X reward points on online spends with partner merchants. Modelled as points per ₹100 (2 points per ₹100).',
        rewardType: 'reward_points',
        rewardValue: 10,
        calcMethod: 'points_per_100',
        eligibleCategories: ['online_shopping'],
        periodType: 'monthly',
        sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/simplyclick-sbi-card.page',
        sourceLabel: 'SBI Card — SimplyCLICK',
        confidence: 'indicative',
        redemptionInstructions: 'Redeem reward points against the catalogue at sbicard.com. Point value varies by redemption.',
        expiryRules: 'Reward points expire as per SBI Card terms (typically 2 years).',
      },
      {
        code: 'SC-FEE-WAIVER',
        name: 'Annual fee waiver on ₹1,00,000 spend',
        category: 'fee_waiver',
        description: 'Annual fee waived on spends of ₹1,00,000 in the membership year.',
        rewardType: 'fee_waiver',
        rewardValue: 499,
        thresholdAmount: 100000,
        calcMethod: 'fee_waiver',
        includeAll: true,
        excludedCategories: COMMON_EXCLUSIONS,
        periodType: 'anniversary_year',
        requiresAnniversary: true,
        sourceUrl: 'https://www.sbicard.com/en/personal/credit-cards/simplyclick-sbi-card.page',
        sourceLabel: 'SBI Card — SimplyCLICK',
        confidence: 'indicative',
      },
    ],
  },
  {
    issuer: 'American Express',
    issuerSlug: 'amex',
    slug: 'amex-platinum-travel',
    name: 'Platinum Travel Credit Card',
    variant: 'Platinum Travel',
    network: 'Amex',
    tier: 'mid',
    annualFee: 5000,
    rewardProgram: 'Membership Rewards',
    officialUrl: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/',
    dataConfidence: 'medium',
    verificationStatus: 'unverified',
    notes: 'Milestone benefits are based on annual spends tiers. Point value left blank because redemption value varies.',
    benefits: [
      {
        code: 'PT-MILESTONE-190K',
        name: '15,000 bonus points at ₹1.9L annual spend',
        category: 'milestone',
        description: 'Bonus Membership Rewards points on crossing ₹1,90,000 spends in the membership year.',
        rewardType: 'reward_points',
        rewardPoints: 15000,
        thresholdAmount: 190000,
        calcMethod: 'milestone',
        includeAll: true,
        excludedCategories: COMMON_EXCLUSIONS,
        periodType: 'anniversary_year',
        requiresAnniversary: true,
        sourceUrl: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/',
        sourceLabel: 'American Express — Platinum Travel',
        confidence: 'indicative',
        redemptionInstructions: 'Bonus points post to the Membership Rewards account after the milestone.',
      },
      {
        code: 'PT-MILESTONE-400K',
        name: '40,000 bonus points at ₹4L annual spend',
        category: 'milestone',
        description: 'Bonus Membership Rewards points on crossing ₹4,00,000 spends in the membership year.',
        rewardType: 'reward_points',
        rewardPoints: 40000,
        thresholdAmount: 400000,
        calcMethod: 'milestone',
        includeAll: true,
        excludedCategories: COMMON_EXCLUSIONS,
        periodType: 'anniversary_year',
        requiresAnniversary: true,
        sourceUrl: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/',
        sourceLabel: 'American Express — Platinum Travel',
        confidence: 'indicative',
      },
    ],
  },
  {
    issuer: 'HDFC Bank',
    issuerSlug: 'hdfc',
    slug: 'hdfc-infinia',
    name: 'Infinia Credit Card',
    variant: 'Infinia',
    network: 'Visa',
    tier: 'super_premium',
    annualFee: 12500,
    rewardProgram: 'HDFC Reward Points',
    officialUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card',
    dataConfidence: 'indicative',
    verificationStatus: 'unverified',
    notes: 'Base rewards plus accelerated SmartBuy rewards. Point value not fixed — shown as points only.',
    benefits: [
      {
        code: 'INF-BASE-PTS',
        name: 'Base reward points on all spends',
        category: 'base',
        description: 'Base reward points on eligible spends (approx. 3.3 points per ₹100).',
        rewardType: 'reward_points',
        rewardValue: 3.3,
        calcMethod: 'points_per_100',
        includeAll: true,
        excludedCategories: COMMON_EXCLUSIONS,
        periodType: 'monthly',
        sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card',
        sourceLabel: 'HDFC Bank — Infinia',
        confidence: 'indicative',
        redemptionInstructions: 'Redeem via HDFC SmartBuy / Reward Points portal. Value depends on redemption route.',
        expiryRules: 'Reward points typically valid for 3 years.',
      },
      {
        code: 'INF-FEE-WAIVER',
        name: 'Annual fee waiver on ₹10,00,000 spend',
        category: 'fee_waiver',
        description: 'Annual fee waived on spends of ₹10,00,000 in the membership year.',
        rewardType: 'fee_waiver',
        rewardValue: 12500,
        thresholdAmount: 1000000,
        calcMethod: 'fee_waiver',
        includeAll: true,
        excludedCategories: COMMON_EXCLUSIONS,
        periodType: 'anniversary_year',
        requiresAnniversary: true,
        sourceUrl: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card',
        sourceLabel: 'HDFC Bank — Infinia',
        confidence: 'indicative',
      },
    ],
  },
  {
    issuer: 'IDFC FIRST Bank',
    issuerSlug: 'idfc',
    slug: 'idfc-first-wow',
    name: 'FIRST WOW Credit Card',
    variant: 'WOW',
    network: 'Visa',
    tier: 'secured',
    annualFee: 0,
    rewardProgram: 'IDFC FIRST Rewards',
    officialUrl: 'https://www.idfcfirstbank.com/credit-card/wow-credit-card',
    dataConfidence: 'medium',
    verificationStatus: 'unverified',
    notes: 'Lifetime-free secured card; zero forex markup. Reward accrual approximated.',
    benefits: [
      {
        code: 'WOW-ONLINE-3X',
        name: '3X reward points on online spends',
        category: 'online_shopping',
        description: 'Accelerated reward points on online spends (approx. 3 points per ₹100).',
        rewardType: 'reward_points',
        rewardValue: 3,
        calcMethod: 'points_per_100',
        eligibleCategories: ['online_shopping', 'dining'],
        periodType: 'monthly',
        sourceUrl: 'https://www.idfcfirstbank.com/credit-card/wow-credit-card',
        sourceLabel: 'IDFC FIRST — WOW',
        confidence: 'indicative',
      },
      {
        code: 'WOW-BASE-1',
        name: 'Base reward points on other spends',
        category: 'base',
        description: 'Base reward points on all other eligible spends.',
        rewardType: 'reward_points',
        rewardValue: 1,
        calcMethod: 'points_per_100',
        includeAll: true,
        excludedCategories: [...COMMON_EXCLUSIONS, 'online_shopping', 'dining'],
        periodType: 'monthly',
        sourceUrl: 'https://www.idfcfirstbank.com/credit-card/wow-credit-card',
        sourceLabel: 'IDFC FIRST — WOW',
        confidence: 'indicative',
      },
    ],
  },
];

export interface SeedSource {
  name: string;
  url: string;
  kind: 'issuer' | 'aggregator' | 'api';
  issuerSlug?: string;
  status?: 'known' | 'unavailable' | 'ok' | 'error';
  notes?: string;
}

export const SEED_SOURCES: SeedSource[] = [
  { name: 'ICICI Amazon Pay card page', url: 'https://www.icicibank.com/card/credit-cards/amazon-pay-credit-card', kind: 'issuer', issuerSlug: 'icici' },
  { name: 'HDFC Millennia card page', url: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/millennia-credit-card', kind: 'issuer', issuerSlug: 'hdfc' },
  { name: 'HDFC Infinia card page', url: 'https://www.hdfcbank.com/personal/pay/cards/credit-cards/infinia-credit-card', kind: 'issuer', issuerSlug: 'hdfc' },
  { name: 'Axis ACE card page', url: 'https://www.axisbank.com/retail/cards/credit-card/ace-credit-card', kind: 'issuer', issuerSlug: 'axis' },
  { name: 'SBI SimplyCLICK page', url: 'https://www.sbicard.com/en/personal/credit-cards/simplyclick-sbi-card.page', kind: 'issuer', issuerSlug: 'sbicard' },
  { name: 'Amex Platinum Travel page', url: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/', kind: 'issuer', issuerSlug: 'amex' },
  { name: 'IDFC FIRST WOW page', url: 'https://www.idfcfirstbank.com/credit-card/wow-credit-card', kind: 'issuer', issuerSlug: 'idfc' },
  {
    name: 'CardAdvisor datasets',
    url: 'https://cardadvisor.in/data/cards.json',
    kind: 'api',
    status: 'ok',
    notes: 'Open dataset (CC BY 4.0), no key required. Import with `npm --workspace server run import:cardadvisor`. A key enables the richer "stated" view.',
  },
];
