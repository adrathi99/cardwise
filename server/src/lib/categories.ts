export const CATEGORIES = [
  'groceries',
  'dining',
  'travel',
  'flights',
  'fuel',
  'utilities',
  'telecom',
  'online_shopping',
  'offline_shopping',
  'entertainment',
  'insurance',
  'rent',
  'education',
  'government',
  'wallet',
  'emi',
  'fees_interest',
  'taxes',
  'refunds',
  'payments',
  'cashback',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Groceries & Supermarkets',
  dining: 'Dining & Food Delivery',
  travel: 'Travel & Hotels',
  flights: 'Flights',
  fuel: 'Fuel',
  utilities: 'Utilities',
  telecom: 'Telecom',
  online_shopping: 'Online Shopping',
  offline_shopping: 'Offline Shopping',
  entertainment: 'Entertainment',
  insurance: 'Insurance',
  rent: 'Rent',
  education: 'Education',
  government: 'Government Payments',
  wallet: 'Wallet Loading',
  emi: 'EMI & Loans',
  fees_interest: 'Fees & Interest',
  taxes: 'Taxes',
  refunds: 'Refunds & Reversals',
  payments: 'Bill Payments',
  cashback: 'Cashback Credits',
  other: 'Other / Uncertain',
};

export const TXN_TYPES = [
  'purchase',
  'refund',
  'payment',
  'fee',
  'interest',
  'tax',
  'emi',
  'cashback',
  'other',
] as const;

export type TxnType = (typeof TXN_TYPES)[number];

// Transaction types that never count toward spending milestones.
export const NON_SPEND_TYPES: TxnType[] = ['payment', 'fee', 'interest', 'tax', 'emi', 'cashback'];
