import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeParsedTxn, computeDedupeHash, extractMerchant } from './normalize.ts';
import { DEFAULT_RULES } from '../categorize/categorizer.ts';

const parsed = (description: string, amount = 1000, direction: 'debit' | 'credit' = 'debit') => ({
  date: '2026-04-02',
  description,
  amount,
  direction,
  raw: description,
  confidence: 0.9,
  warnings: [],
});

test('categorises known merchants', () => {
  assert.equal(normalizeParsedTxn(parsed('SWIGGY INSTAMART BANGALORE'), 1, DEFAULT_RULES).category, 'dining');
  assert.equal(normalizeParsedTxn(parsed('BIGBASKET GROCERY'), 1, DEFAULT_RULES).category, 'groceries');
  assert.equal(normalizeParsedTxn(parsed('AMAZON INDIA MARKETPLACE'), 1, DEFAULT_RULES).category, 'online_shopping');
  assert.equal(normalizeParsedTxn(parsed('HP PETROL PUMP'), 1, DEFAULT_RULES).category, 'fuel');
});

test('detects transaction types', () => {
  assert.equal(normalizeParsedTxn(parsed('PAYMENT RECEIVED - THANK YOU', 5000, 'credit'), 1, DEFAULT_RULES).txn_type, 'payment');
  assert.equal(normalizeParsedTxn(parsed('REFUND AMAZON INDIA', 1299, 'credit'), 1, DEFAULT_RULES).txn_type, 'refund');
  assert.equal(normalizeParsedTxn(parsed('LATE PAYMENT CHARGES'), 1, DEFAULT_RULES).txn_type, 'fee');
  assert.equal(normalizeParsedTxn(parsed('GST ON FEES'), 1, DEFAULT_RULES).txn_type, 'tax');
});

test('card bill payments are marked excluded', () => {
  const n = normalizeParsedTxn(parsed('PAYMENT RECEIVED - THANK YOU', 5000, 'credit'), 1, DEFAULT_RULES);
  assert.equal(n.is_excluded, 1);
  assert.equal(n.category, 'payments');
});

test('unknown merchants fall back to other with low confidence', () => {
  const n = normalizeParsedTxn(parsed('ZZQX RANDOM VENDOR 99887'), 1, DEFAULT_RULES);
  assert.equal(n.category, 'other');
  assert.equal(n.category_source, 'default');
  assert.ok(n.confidence < 0.5);
});

test('dedupe hash is stable and description-normalised', () => {
  const a = computeDedupeHash(1, '2026-04-02', 4999, 'debit', 'AMAZON INDIA MARKETPLACE REF 8821345');
  const b = computeDedupeHash(1, '2026-04-02', 4999, 'debit', 'AMAZON INDIA MARKETPLACE REF 9999999');
  assert.equal(a, b);
  const c = computeDedupeHash(2, '2026-04-02', 4999, 'debit', 'AMAZON INDIA MARKETPLACE REF 8821345');
  assert.notEqual(a, c);
});

test('extractMerchant strips reference numbers', () => {
  const m = extractMerchant('AMAZON INDIA MARKETPLACE REF 8821345');
  assert.ok(!m.includes('8821345'));
  assert.match(m, /AMAZON/);
});
