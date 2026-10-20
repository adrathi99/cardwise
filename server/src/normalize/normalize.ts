import { createHash } from 'node:crypto';
import type { ParsedTxn } from '../parsing/statementParser.ts';
import { categorize, detectTxnType, type Rule } from '../categorize/categorizer.ts';
import { NON_SPEND_TYPES } from '../lib/categories.ts';

export interface NormalizedTxn {
  txn_date: string;
  description: string;
  merchant: string;
  amount: number;
  direction: 'debit' | 'credit';
  txn_type: string;
  category: string;
  category_source: 'rule' | 'default' | 'manual' | 'ai';
  confidence: number;
  is_excluded: number;
  exclusion_reason: string | null;
  dedupe_hash: string;
}

const REF_PATTERNS = [
  /\b(ref|rrn|txn|transaction|auth|approval|utr|arn|invoice|bill)\b[.:#\s-]*[a-z0-9]{4,}/gi,
  /\b\d{6,}\b/g,
  /\b\d{4}\s?\*+\s?\d{2,4}\b/g,
  /\bXX+\d+\b/gi,
];

export function extractMerchant(description: string): string {
  let s = description;
  for (const re of REF_PATTERNS) s = s.replace(re, ' ');
  s = s.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/[*#]+$/g, '').trim();
  const cut = s.slice(0, 48).trim();
  return cut || description.slice(0, 48).trim();
}

export function computeDedupeHash(
  userCardId: number,
  txnDate: string,
  amount: number,
  direction: string,
  description: string,
): string {
  const normalized = extractMerchant(description).toLowerCase().replace(/\s+/g, ' ');
  const basis = `${userCardId}|${txnDate}|${amount.toFixed(2)}|${direction}|${normalized}`;
  return createHash('sha1').update(basis).digest('hex');
}

function exclusionInfo(txnType: string, category: string): { isExcluded: number; reason: string | null } {
  if (txnType === 'payment') return { isExcluded: 1, reason: 'Card bill payment — not a purchase' };
  if (txnType === 'refund') return { isExcluded: 0, reason: 'Refund/reversal — reduces eligible spend' };
  if ((NON_SPEND_TYPES as string[]).includes(txnType)) return { isExcluded: 1, reason: `Excluded transaction type: ${txnType}` };
  if (category === 'fuel') return { isExcluded: 0, reason: null };
  return { isExcluded: 0, reason: null };
}

export function normalizeParsedTxn(p: ParsedTxn, userCardId: number, rules: Rule[]): NormalizedTxn {
  const txnType = detectTxnType(p.description);
  let category: string;
  let categorySource: 'rule' | 'default' = 'rule';
  let confidence = p.confidence;

  if (txnType === 'payment') category = 'payments';
  else if (txnType === 'fee' || txnType === 'interest') category = 'fees_interest';
  else if (txnType === 'tax') category = 'taxes';
  else if (txnType === 'cashback') category = 'cashback';
  else if (txnType === 'emi') category = 'emi';
  else {
    const res = categorize(p.description, rules);
    category = res.category;
    categorySource = res.source === 'rule' ? 'rule' : 'default';
    confidence = Math.min(confidence, res.confidence + 0.1);
  }

  if (txnType === 'refund' && category === 'other') category = 'refunds';

  const { isExcluded, reason } = exclusionInfo(txnType, category);
  const merchant = extractMerchant(p.description);

  return {
    txn_date: p.date,
    description: p.description,
    merchant,
    amount: p.amount,
    direction: p.direction,
    txn_type: txnType,
    category,
    category_source: categorySource,
    confidence: Math.round(confidence * 100) / 100,
    is_excluded: isExcluded,
    exclusion_reason: reason,
    dedupe_hash: computeDedupeHash(userCardId, p.date, p.amount, p.direction, p.description),
  };
}
