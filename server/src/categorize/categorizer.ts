import { CATEGORIES, type Category, type TxnType } from '../lib/categories.ts';

export interface Rule {
  pattern: string;
  category: Category;
  priority: number;
}

export const DEFAULT_RULES: Rule[] = [
  // payments / credits (checked first via txn type too)
  { pattern: 'PAYMENT RECEIVED', category: 'payments', priority: 1 },
  { pattern: 'PAYMENT THANK YOU', category: 'payments', priority: 1 },
  { pattern: 'CARD PAYMENT', category: 'payments', priority: 2 },
  { pattern: 'CREDIT CARD PAY', category: 'payments', priority: 2 },
  { pattern: 'NET BANKING', category: 'payments', priority: 2 },
  { pattern: 'NETBANKING', category: 'payments', priority: 2 },
  { pattern: 'BILLPAY', category: 'payments', priority: 2 },
  { pattern: 'BILL PAY', category: 'payments', priority: 2 },
  { pattern: 'BBPS', category: 'payments', priority: 2 },
  { pattern: 'MANDATE', category: 'payments', priority: 3 },
  { pattern: 'AUTOPAY', category: 'payments', priority: 3 },
  { pattern: 'UPI', category: 'payments', priority: 5 },
  { pattern: 'NEFT', category: 'payments', priority: 4 },
  { pattern: 'IMPS', category: 'payments', priority: 4 },
  { pattern: 'RTGS', category: 'payments', priority: 4 },

  // fees & interest
  { pattern: 'LATE PAYMENT', category: 'fees_interest', priority: 1 },
  { pattern: 'FINANCE CHARGE', category: 'fees_interest', priority: 1 },
  { pattern: 'ANNUAL FEE', category: 'fees_interest', priority: 1 },
  { pattern: 'MEMBERSHIP FEE', category: 'fees_interest', priority: 1 },
  { pattern: 'JOINING FEE', category: 'fees_interest', priority: 1 },
  { pattern: 'RENEWAL FEE', category: 'fees_interest', priority: 1 },
  { pattern: 'LATE FEE', category: 'fees_interest', priority: 1 },
  { pattern: 'PENALTY', category: 'fees_interest', priority: 2 },
  { pattern: 'INTEREST CHARGED', category: 'fees_interest', priority: 1 },
  { pattern: 'CONVENIENCE FEE', category: 'fees_interest', priority: 2 },
  { pattern: 'SERVICE CHARGE', category: 'fees_interest', priority: 2 },
  { pattern: 'PROCESSING FEE', category: 'fees_interest', priority: 2 },
  { pattern: 'CASH ADVANCE FEE', category: 'fees_interest', priority: 1 },
  { pattern: 'INTEREST', category: 'fees_interest', priority: 4 },

  // taxes
  { pattern: 'GST', category: 'taxes', priority: 5 },
  { pattern: 'IGST', category: 'taxes', priority: 3 },
  { pattern: 'CGST', category: 'taxes', priority: 3 },
  { pattern: 'SGST', category: 'taxes', priority: 3 },
  { pattern: 'TDS', category: 'taxes', priority: 3 },

  // refunds / cashback
  { pattern: 'REFUND', category: 'refunds', priority: 5 },
  { pattern: 'REVERSAL', category: 'refunds', priority: 3 },
  { pattern: 'CHARGEBACK', category: 'refunds', priority: 2 },
  { pattern: 'CASHBACK', category: 'cashback', priority: 2 },
  { pattern: 'REWARD CREDIT', category: 'cashback', priority: 2 },
  { pattern: 'OFFER CREDIT', category: 'cashback', priority: 3 },

  // emi / loans
  { pattern: 'EMI', category: 'emi', priority: 5 },
  { pattern: 'INSTALMENT', category: 'emi', priority: 4 },
  { pattern: 'INSTALLMENT', category: 'emi', priority: 4 },
  { pattern: 'BAJAJ FINANCE', category: 'emi', priority: 3 },
  { pattern: 'HDB FINANCIAL', category: 'emi', priority: 3 },

  // wallet
  { pattern: 'PAYTM', category: 'wallet', priority: 10 },
  { pattern: 'PHONEPE', category: 'wallet', priority: 10 },
  { pattern: 'MOBIKWIK', category: 'wallet', priority: 9 },
  { pattern: 'FREECHARGE', category: 'wallet', priority: 9 },
  { pattern: 'AMAZON PAY BALANCE', category: 'wallet', priority: 8 },
  { pattern: 'OLA MONEY', category: 'wallet', priority: 9 },
  { pattern: 'WALLET', category: 'wallet', priority: 12 },

  // groceries
  { pattern: 'BIGBASKET', category: 'groceries', priority: 10 },
  { pattern: 'BIG BASKET', category: 'groceries', priority: 10 },
  { pattern: 'DMART', category: 'groceries', priority: 10 },
  { pattern: 'D MART', category: 'groceries', priority: 10 },
  { pattern: 'RELIANCE FRESH', category: 'groceries', priority: 9 },
  { pattern: 'MORE MEGASTORE', category: 'groceries', priority: 9 },
  { pattern: 'ZEPTO', category: 'groceries', priority: 10 },
  { pattern: 'BLINKIT', category: 'groceries', priority: 10 },
  { pattern: 'GROFERS', category: 'groceries', priority: 10 },
  { pattern: 'NATURES BASKET', category: 'groceries', priority: 9 },
  { pattern: 'SPENCER', category: 'groceries', priority: 12 },
  { pattern: 'SUPERMARKET', category: 'groceries', priority: 20 },
  { pattern: 'GROCERY', category: 'groceries', priority: 18 },

  // dining
  { pattern: 'SWIGGY', category: 'dining', priority: 10 },
  { pattern: 'ZOMATO', category: 'dining', priority: 10 },
  { pattern: 'DOMINOS', category: 'dining', priority: 12 },
  { pattern: 'MCDONALD', category: 'dining', priority: 12 },
  { pattern: 'KFC', category: 'dining', priority: 12 },
  { pattern: 'BURGER KING', category: 'dining', priority: 12 },
  { pattern: 'PIZZA HUT', category: 'dining', priority: 12 },
  { pattern: 'STARBUCKS', category: 'dining', priority: 12 },
  { pattern: 'CAFE', category: 'dining', priority: 22 },
  { pattern: 'RESTAURANT', category: 'dining', priority: 20 },
  { pattern: 'FAASOS', category: 'dining', priority: 12 },
  { pattern: 'EATFIT', category: 'dining', priority: 12 },

  // travel
  { pattern: 'MAKEMYTRIP', category: 'travel', priority: 10 },
  { pattern: 'YATRA', category: 'travel', priority: 10 },
  { pattern: 'GOIBIBO', category: 'travel', priority: 10 },
  { pattern: 'CLEARTRIP', category: 'travel', priority: 10 },
  { pattern: 'EASEMYTRIP', category: 'travel', priority: 10 },
  { pattern: 'REDBUS', category: 'travel', priority: 10 },
  { pattern: 'ABHIBUS', category: 'travel', priority: 10 },
  { pattern: 'IRCTC', category: 'travel', priority: 10 },
  { pattern: 'OYO', category: 'travel', priority: 12 },
  { pattern: 'AIRBNB', category: 'travel', priority: 10 },
  { pattern: 'BOOKING.COM', category: 'travel', priority: 10 },
  { pattern: 'HOTEL', category: 'travel', priority: 22 },
  { pattern: 'RESORT', category: 'travel', priority: 22 },
  { pattern: 'THOMAS COOK', category: 'travel', priority: 10 },

  // flights
  { pattern: 'INDIGO', category: 'flights', priority: 8 },
  { pattern: 'AIR INDIA', category: 'flights', priority: 8 },
  { pattern: 'AIRINDIA', category: 'flights', priority: 8 },
  { pattern: 'SPICEJET', category: 'flights', priority: 8 },
  { pattern: 'VISTARA', category: 'flights', priority: 8 },
  { pattern: 'AKASA', category: 'flights', priority: 8 },
  { pattern: 'EMIRATES', category: 'flights', priority: 8 },
  { pattern: 'QATAR AIR', category: 'flights', priority: 8 },
  { pattern: 'LUFTHANSA', category: 'flights', priority: 8 },
  { pattern: 'FLIGHT', category: 'flights', priority: 24 },

  // fuel
  { pattern: 'HPCL', category: 'fuel', priority: 8 },
  { pattern: 'HP PETRO', category: 'fuel', priority: 8 },
  { pattern: 'INDIAN OIL', category: 'fuel', priority: 8 },
  { pattern: 'IOCL', category: 'fuel', priority: 8 },
  { pattern: 'BPCL', category: 'fuel', priority: 8 },
  { pattern: 'BHARAT PETRO', category: 'fuel', priority: 8 },
  { pattern: 'SHELL', category: 'fuel', priority: 12 },
  { pattern: 'PETROL', category: 'fuel', priority: 18 },
  { pattern: 'FUEL', category: 'fuel', priority: 18 },
  { pattern: 'ESSAR OIL', category: 'fuel', priority: 8 },

  // utilities
  { pattern: 'ELECTRICITY', category: 'utilities', priority: 12 },
  { pattern: 'TATA POWER', category: 'utilities', priority: 8 },
  { pattern: 'ADANI ELECTRICITY', category: 'utilities', priority: 8 },
  { pattern: 'BSES', category: 'utilities', priority: 8 },
  { pattern: 'BESCOM', category: 'utilities', priority: 8 },
  { pattern: 'MSEB', category: 'utilities', priority: 8 },
  { pattern: 'MAHANAGAR GAS', category: 'utilities', priority: 8 },
  { pattern: 'INDRAPRASTHA GAS', category: 'utilities', priority: 8 },
  { pattern: 'GAS BILL', category: 'utilities', priority: 12 },
  { pattern: 'WATER BILL', category: 'utilities', priority: 12 },

  // telecom
  { pattern: 'AIRTEL', category: 'telecom', priority: 8 },
  { pattern: 'JIO', category: 'telecom', priority: 9 },
  { pattern: 'VODAFONE', category: 'telecom', priority: 8 },
  { pattern: 'VI POSTPAID', category: 'telecom', priority: 8 },
  { pattern: 'BSNL', category: 'telecom', priority: 8 },
  { pattern: 'ACT FIBERNET', category: 'telecom', priority: 8 },
  { pattern: 'HATHWAY', category: 'telecom', priority: 8 },
  { pattern: 'BROADBAND', category: 'telecom', priority: 16 },
  { pattern: 'TATA SKY', category: 'telecom', priority: 8 },
  { pattern: 'TATA PLAY', category: 'telecom', priority: 8 },
  { pattern: 'DTH', category: 'telecom', priority: 14 },
  { pattern: 'RECHARGE', category: 'telecom', priority: 16 },
  { pattern: 'POSTPAID', category: 'telecom', priority: 12 },

  // online shopping
  { pattern: 'AMAZON', category: 'online_shopping', priority: 12 },
  { pattern: 'FLIPKART', category: 'online_shopping', priority: 8 },
  { pattern: 'MYNTRA', category: 'online_shopping', priority: 8 },
  { pattern: 'AJIO', category: 'online_shopping', priority: 8 },
  { pattern: 'MEESHO', category: 'online_shopping', priority: 8 },
  { pattern: 'NYKAA', category: 'online_shopping', priority: 8 },
  { pattern: 'SNAPDEAL', category: 'online_shopping', priority: 8 },
  { pattern: 'TATACLIQ', category: 'online_shopping', priority: 8 },
  { pattern: 'LENSKART', category: 'online_shopping', priority: 8 },
  { pattern: 'CROMA', category: 'online_shopping', priority: 12 },
  { pattern: 'RELIANCE DIGITAL', category: 'online_shopping', priority: 8 },
  { pattern: 'FIRSTCRY', category: 'online_shopping', priority: 8 },
  { pattern: 'DECATHLON', category: 'online_shopping', priority: 8 },
  { pattern: 'EBAY', category: 'online_shopping', priority: 8 },
  { pattern: 'ALIBABA', category: 'online_shopping', priority: 8 },

  // offline shopping
  { pattern: 'SHOPPERS STOP', category: 'offline_shopping', priority: 10 },
  { pattern: 'WEST SIDE', category: 'offline_shopping', priority: 10 },
  { pattern: 'PANTALOON', category: 'offline_shopping', priority: 10 },
  { pattern: 'LIFESTYLE', category: 'offline_shopping', priority: 14 },
  { pattern: 'MAX FASHION', category: 'offline_shopping', priority: 10 },
  { pattern: 'VIJAY SALES', category: 'offline_shopping', priority: 10 },
  { pattern: 'PUMA', category: 'offline_shopping', priority: 10 },
  { pattern: 'ADIDAS', category: 'offline_shopping', priority: 10 },
  { pattern: 'ZARA', category: 'offline_shopping', priority: 10 },

  // entertainment
  { pattern: 'NETFLIX', category: 'entertainment', priority: 8 },
  { pattern: 'PRIME VIDEO', category: 'entertainment', priority: 8 },
  { pattern: 'HOTSTAR', category: 'entertainment', priority: 8 },
  { pattern: 'DISNEY', category: 'entertainment', priority: 8 },
  { pattern: 'SPOTIFY', category: 'entertainment', priority: 8 },
  { pattern: 'BOOKMYSHOW', category: 'entertainment', priority: 8 },
  { pattern: 'PVR', category: 'entertainment', priority: 10 },
  { pattern: 'INOX', category: 'entertainment', priority: 10 },
  { pattern: 'CINEPOLIS', category: 'entertainment', priority: 10 },
  { pattern: 'ZEE5', category: 'entertainment', priority: 8 },
  { pattern: 'SONYLIV', category: 'entertainment', priority: 8 },
  { pattern: 'SONY LIV', category: 'entertainment', priority: 8 },
  { pattern: 'AUDIBLE', category: 'entertainment', priority: 8 },
  { pattern: 'YOUTUBE', category: 'entertainment', priority: 8 },

  // insurance
  { pattern: 'INSURANCE', category: 'insurance', priority: 16 },
  { pattern: 'LIC', category: 'insurance', priority: 12 },
  { pattern: 'HDFC LIFE', category: 'insurance', priority: 8 },
  { pattern: 'ICICI PRUDENTIAL', category: 'insurance', priority: 8 },
  { pattern: 'SBI LIFE', category: 'insurance', priority: 8 },
  { pattern: 'MAX LIFE', category: 'insurance', priority: 8 },
  { pattern: 'BAJAJ ALLIANZ', category: 'insurance', priority: 8 },
  { pattern: 'STAR HEALTH', category: 'insurance', priority: 8 },
  { pattern: 'NIVA BUPA', category: 'insurance', priority: 8 },
  { pattern: 'POLICYBAZAAR', category: 'insurance', priority: 8 },
  { pattern: 'ACKO', category: 'insurance', priority: 8 },

  // rent
  { pattern: 'NOBROKER', category: 'rent', priority: 8 },
  { pattern: 'RENTPAY', category: 'rent', priority: 8 },
  { pattern: 'REDGIRRA', category: 'rent', priority: 8 },
  { pattern: 'MYGATE', category: 'rent', priority: 8 },
  { pattern: 'HOUSING', category: 'rent', priority: 14 },
  { pattern: 'RENT', category: 'rent', priority: 20 },

  // education
  { pattern: 'BYJU', category: 'education', priority: 8 },
  { pattern: 'UNACADEMY', category: 'education', priority: 8 },
  { pattern: 'VEDANTU', category: 'education', priority: 8 },
  { pattern: 'COURSERA', category: 'education', priority: 8 },
  { pattern: 'UDEMY', category: 'education', priority: 8 },
  { pattern: 'UPGRAD', category: 'education', priority: 8 },
  { pattern: 'SIMPLILEARN', category: 'education', priority: 8 },
  { pattern: 'SCHOOL FEE', category: 'education', priority: 8 },
  { pattern: 'TUITION', category: 'education', priority: 12 },
  { pattern: 'COLLEGE', category: 'education', priority: 14 },
  { pattern: 'UNIVERSITY', category: 'education', priority: 14 },

  // government
  { pattern: 'INCOME TAX', category: 'government', priority: 8 },
  { pattern: 'GOVERNMENT', category: 'government', priority: 14 },
  { pattern: 'GOVT', category: 'government', priority: 14 },
  { pattern: 'NSDL', category: 'government', priority: 8 },
  { pattern: 'PASSPORT', category: 'government', priority: 8 },
  { pattern: 'CHALLAN', category: 'government', priority: 8 },
  { pattern: 'MUNICIPAL', category: 'government', priority: 10 },
];

export interface CategoryResult {
  category: Category;
  confidence: number;
  source: 'rule' | 'manual' | 'default' | 'ai';
}

export function detectTxnType(description: string): TxnType {
  const d = description.toUpperCase();
  const has = (...keys: string[]) => keys.some((k) => d.includes(k));
  if (has('REFUND', 'REVERSAL', 'CHARGEBACK', 'REVERSED', 'CR ADJ')) return 'refund';
  if (has('CASHBACK', 'REWARD CREDIT', 'OFFER CREDIT', 'CB CREDIT')) return 'cashback';
  if (
    has(
      'PAYMENT RECEIVED',
      'PAYMENT THANK YOU',
      'NET BANKING',
      'NETBANKING',
      'BILLPAY',
      'BILL PAY',
      'BBPS',
      'MANDATE',
      'AUTOPAY',
      'CREDIT CARD PAY',
      'CARD PAYMENT',
    )
  )
    return 'payment';
  if (has('FINANCE CHARGE', 'INTEREST CHARGED', 'INTEREST')) return 'interest';
  if (has('LATE PAYMENT', 'ANNUAL FEE', 'MEMBERSHIP FEE', 'JOINING FEE', 'RENEWAL FEE', 'LATE FEE', 'PENALTY', 'SERVICE CHARGE', 'CONVENIENCE FEE', 'PROCESSING FEE'))
    return 'fee';
  if (has('CGST', 'SGST', 'IGST', 'GST', 'TDS')) return 'tax';
  if (has('EMI', 'INSTALMENT', 'INSTALLMENT')) return 'emi';
  return 'purchase';
}

export function categorize(description: string, rules: Rule[] = DEFAULT_RULES): CategoryResult {
  const d = description.toUpperCase();
  let best: Rule | null = null;
  for (const r of rules) {
    if (d.includes(r.pattern)) {
      if (!best || r.priority < best.priority || (r.priority === best.priority && r.pattern.length > best.pattern.length)) {
        best = r;
      }
    }
  }
  if (best) {
    const confidence = best.pattern.length >= 6 ? 0.92 : best.pattern.length >= 4 ? 0.75 : 0.55;
    return { category: best.category, confidence, source: 'rule' };
  }
  return { category: 'other', confidence: 0.25, source: 'default' };
}

export function isKnownCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
