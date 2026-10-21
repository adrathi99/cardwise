import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePerkGate, pointsPerHundred } from './import.ts';

test('parses a quarterly lounge gate', () => {
  const d =
    '2 domestic lounge visits a quarter (gated behind ₹75,000/quarter spend) plus 2 international visits a year — via Priority Pass.';
  assert.deepEqual(parsePerkGate(d), { amount: 75000, periodType: 'quarterly' });
});

test('parses a quarterly gate phrased with "of quarterly spend"', () => {
  const d = 'Buy one BookMyShow ticket and get up to ₹500 off the second, twice a month, gated behind ₹25,000 of quarterly spend (from 15 Jan 2026)';
  assert.deepEqual(parsePerkGate(d), { amount: 25000, periodType: 'quarterly' });
});

test('handles lakh units and annual periods', () => {
  const d = 'Complimentary lounge access requires ₹1.5 lakh of annual spend';
  assert.deepEqual(parsePerkGate(d), { amount: 150000, periodType: 'anniversary_year' });
});

test('ignores retention language that is not a gate', () => {
  const d = 'retain Emirates Silver Tier with ₹5 lakh of annual spend';
  assert.equal(parsePerkGate(d), null);
});

test('returns a null period when the gate has no cadence', () => {
  assert.deepEqual(parsePerkGate('Gated behind ₹2,500 spend'), { amount: 2500, periodType: null });
});

test('parses "unlocked by spending" without inventing a monthly period', () => {
  const d = 'unlocked by spending ₹50,000 in the previous 3 calendar months';
  assert.deepEqual(parsePerkGate(d), { amount: 50000, periodType: null });
});

test('parses a "needs ₹X of spend in the preceding quarter" gate', () => {
  const d = 'BookMyShow — buy one ticket and get up to ₹500 off the second, twice a month; needs ₹25,000 of spend in the preceding quarter';
  assert.deepEqual(parsePerkGate(d), { amount: 25000, periodType: 'quarterly' });
});

test('parses "on ₹1 lakh of spend in the previous quarter" without a gate verb', () => {
  const d = 'A domestic lounge visit each quarter on ₹1 lakh of spend in the previous quarter, issued as a voucher.';
  assert.deepEqual(parsePerkGate(d), { amount: 100000, periodType: 'quarterly' });
});

test('parses "for every ₹X of retail spend in the previous calendar month"', () => {
  const d = 'Up to 4 complimentary golf rounds a month — one round for every ₹50,000 of retail spend in the previous calendar month';
  assert.deepEqual(parsePerkGate(d), { amount: 50000, periodType: 'monthly' });
});

test('does not treat txn limits or caps as spend gates', () => {
  const fuel = '1% fuel surcharge waiver on transactions up to ₹4,000 at any fuel outlet';
  assert.equal(parsePerkGate(fuel), null);
  const cap = '1% fuel surcharge waiver at all fuel stations (₹400–₹5,000 per txn), capped ₹250/statement cycle';
  assert.equal(parsePerkGate(cap), null);
});

test('prefers the described quarterly gate over an annual roll-up', () => {
  const d =
    '₹1,500 voucher each calendar quarter on ₹1.5 lakh of spend in that quarter - ₹6,000 a year only if you clear the bar in all four quarters';
  assert.deepEqual(parsePerkGate(d), { amount: 150000, periodType: 'quarterly' });
});

test('parses a monthly golf gate', () => {
  const d =
    'Up to 4 complimentary golf rounds a month - one round for every ₹50,000 of retail spend in the previous calendar month';
  assert.deepEqual(parsePerkGate(d), { amount: 50000, periodType: 'monthly' });
});

test('computes points per ₹100 from the effective rate and point value', () => {
  assert.equal(pointsPerHundred({ rewardRate: null, ratePct: 0.5, pointValuePaisa: 25 }), 2);
  assert.equal(pointsPerHundred({ rewardRate: 0.02, ratePct: 0.5, pointValuePaisa: 25 }), 2);
  assert.equal(pointsPerHundred({ rewardRate: null, ratePct: 0.25, pointValuePaisa: 25 }), 1);
  assert.equal(pointsPerHundred({ rewardRate: null, ratePct: 0.5, pointValuePaisa: null }), null);
});

test('keeps cashback rewards in percent, not points', () => {
  assert.equal(pointsPerHundred({ rewardRate: null, ratePct: 5, pointValuePaisa: null }), null);
});
