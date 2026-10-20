import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndianAmount, formatINR, round2 } from './money.ts';

test('parses indian formatted amounts', () => {
  assert.equal(parseIndianAmount('1,23,456.78'), 123456.78);
  assert.equal(parseIndianAmount('₹ 4,999.00'), 4999);
  assert.equal(parseIndianAmount('999.50'), 999.5);
  assert.equal(parseIndianAmount('1,234'), 1234);
});

test('parses negatives and parentheses', () => {
  assert.equal(parseIndianAmount('(500.00)'), -500);
  assert.equal(parseIndianAmount('-250.00'), -250);
});

test('rejects non-numeric', () => {
  assert.equal(parseIndianAmount('abc'), null);
  assert.equal(parseIndianAmount(''), null);
});

test('formats INR with lakh grouping', () => {
  assert.equal(formatINR(123456), '₹1,23,456');
  assert.equal(formatINR(1000), '₹1,000');
  assert.equal(formatINR(-500), '-₹500');
  assert.equal(formatINR(9999.5, { decimals: 2 }), '₹9,999.50');
});

test('round2 rounds to two decimals', () => {
  assert.equal(round2(1.005), 1.0);
  assert.equal(round2(2.345), 2.35);
});
