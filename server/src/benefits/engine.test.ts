import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBenefit, type BenefitRow, type TxnRow } from './engine.ts';

function benefit(over: Partial<BenefitRow>): BenefitRow {
  return {
    id: 1,
    card_product_id: 1,
    code: 'X',
    name: 'Test benefit',
    category: 'test',
    description: null,
    reward_type: 'cashback',
    reward_value: null,
    reward_points: null,
    point_value_inr: null,
    threshold_amount: null,
    min_eligible_spend: null,
    calc_method: 'cashback_percent',
    include_all: 1,
    eligible_categories: null,
    excluded_categories: null,
    cap_amount: null,
    cap_points: null,
    period_type: 'calendar_year',
    period_start_rule: null,
    requires_anniversary: 0,
    requires_activation: 0,
    effective_from: null,
    effective_until: null,
    redemption_instructions: null,
    expiry_rules: null,
    source_url: 'https://example.com',
    source_label: 'Example',
    verified_at: null,
    confidence: 'high',
    status: 'active',
    version: 1,
    ...over,
  };
}

function txn(over: Partial<TxnRow>): TxnRow {
  return {
    id: Math.floor(Math.random() * 1e9),
    user_card_id: 1,
    txn_date: '2025-06-10',
    amount: 1000,
    direction: 'debit',
    txn_type: 'purchase',
    category: 'online_shopping',
    confidence: 0.9,
    ...over,
  };
}

const ref = new Date('2025-06-15T00:00:00Z');

test('cashback percent basic', () => {
  const b = benefit({ calc_method: 'cashback_percent', reward_value: 5, eligible_categories: JSON.stringify(['online_shopping']), include_all: 0 });
  const p = evaluateBenefit(b, [txn({ amount: 10000 })], { refDate: ref });
  assert.equal(p.eligibleSpend, 10000);
  assert.equal(p.earnedValue, 500);
  assert.equal(p.status, 'earning');
});

test('cashback cap is applied', () => {
  const b = benefit({ calc_method: 'cashback_percent', reward_value: 5, cap_amount: 1000, include_all: 1 });
  const p = evaluateBenefit(b, [txn({ amount: 30000 })], { refDate: ref });
  assert.equal(p.earnedValue, 1000);
  assert.equal(p.capRemaining, 0);
});

test('milestone below / exactly at / above threshold', () => {
  const b = benefit({ calc_method: 'milestone', reward_value: 1000, threshold_amount: 10000, include_all: 1 });
  const below = evaluateBenefit(b, [txn({ amount: 9999 })], { refDate: ref });
  assert.equal(below.status, 'in_progress');
  assert.equal(below.earnedValue, 0);
  assert.equal(below.remainingToThreshold, 1);
  const at = evaluateBenefit(b, [txn({ amount: 10000 })], { refDate: ref });
  assert.equal(at.status, 'earned');
  assert.equal(at.earnedValue, 1000);
  assert.equal(at.progressPct, 100);
  const above = evaluateBenefit(b, [txn({ amount: 25000 })], { refDate: ref });
  assert.equal(above.status, 'earned');
  assert.equal(above.remainingToThreshold, 0);
});

test('refunds reduce eligible spend and are clamped at zero', () => {
  const b = benefit({ calc_method: 'cashback_percent', reward_value: 5, include_all: 1 });
  const p = evaluateBenefit(
    b,
    [txn({ amount: 10000 }), txn({ amount: 2000, direction: 'credit', txn_type: 'refund' })],
    { refDate: ref },
  );
  assert.equal(p.eligibleSpend, 8000);
  assert.equal(p.earnedValue, 400);
  assert.equal(p.refundAdjustment, 2000);
  const clamped = evaluateBenefit(b, [txn({ amount: 1000 }), txn({ amount: 5000, direction: 'credit', txn_type: 'refund' })], { refDate: ref });
  assert.equal(clamped.eligibleSpend, 0);
});

test('card bill payments never count toward spend', () => {
  const b = benefit({ calc_method: 'milestone', reward_value: 500, threshold_amount: 5000, include_all: 1 });
  const p = evaluateBenefit(
    b,
    [txn({ amount: 2000 }), txn({ amount: 50000, direction: 'credit', txn_type: 'payment', category: 'payments' })],
    { refDate: ref },
  );
  assert.equal(p.eligibleSpend, 2000);
  assert.equal(p.status, 'in_progress');
});

test('excluded categories are ignored for include_all benefits', () => {
  const b = benefit({ include_all: 1, excluded_categories: JSON.stringify(['fuel', 'wallet']), calc_method: 'cashback_percent', reward_value: 2 });
  const p = evaluateBenefit(
    b,
    [txn({ amount: 1000, category: 'fuel' }), txn({ amount: 1000, category: 'wallet' }), txn({ amount: 2000, category: 'dining' })],
    { refDate: ref },
  );
  assert.equal(p.eligibleSpend, 2000);
});

test('fees, interest and taxes are excluded', () => {
  const b = benefit({ include_all: 1, calc_method: 'cashback_percent', reward_value: 1 });
  const p = evaluateBenefit(
    b,
    [
      txn({ amount: 500, txn_type: 'fee', category: 'fees_interest' }),
      txn({ amount: 5000, txn_type: 'interest', category: 'fees_interest' }),
      txn({ amount: 900, txn_type: 'tax', category: 'taxes' }),
      txn({ amount: 1000, category: 'dining' }),
    ],
    { refDate: ref },
  );
  assert.equal(p.eligibleSpend, 1000);
});

test('reward points per 100 with known conversion', () => {
  const b = benefit({ calc_method: 'points_per_100', reward_value: 5, point_value_inr: 0.25, include_all: 1 });
  const p = evaluateBenefit(b, [txn({ amount: 10000 })], { refDate: ref });
  assert.equal(p.earnedPoints, 500);
  assert.equal(p.earnedValue, 125);
  assert.equal(p.ratePercent, 1.25);
});

test('reward points with unknown conversion show points but no rupee value', () => {
  const b = benefit({ calc_method: 'points_per_100', reward_value: 3.3, point_value_inr: null, include_all: 1 });
  const p = evaluateBenefit(b, [txn({ amount: 10000 })], { refDate: ref });
  assert.equal(p.earnedPoints, 330);
  assert.equal(p.earnedValue, null);
  assert.equal(p.valueIsKnown, false);
});

test('financial-year benefit ignores transactions outside the period', () => {
  const b = benefit({ period_type: 'financial_year', calc_method: 'milestone', reward_value: 1000, threshold_amount: 10000, include_all: 1 });
  const p = evaluateBenefit(
    b,
    [txn({ amount: 6000, txn_date: '2025-03-31' }), txn({ amount: 5000, txn_date: '2025-04-01' })],
    { refDate: ref },
  );
  assert.equal(p.eligibleSpend, 5000);
  assert.equal(p.period.start, '2025-04-01');
});

test('monthly benefit only sees the current month', () => {
  const b = benefit({ period_type: 'monthly', calc_method: 'cashback_percent', reward_value: 5, include_all: 1 });
  const p = evaluateBenefit(
    b,
    [txn({ amount: 5000, txn_date: '2025-05-31' }), txn({ amount: 4000, txn_date: '2025-06-01' })],
    { refDate: ref },
  );
  assert.equal(p.eligibleSpend, 4000);
});

test('anniversary-year benefit uses the anniversary window', () => {
  const b = benefit({ period_type: 'anniversary_year', requires_anniversary: 1, calc_method: 'milestone', reward_value: 1000, threshold_amount: 10000, include_all: 1 });
  const p = evaluateBenefit(
    b,
    [txn({ amount: 4000, txn_date: '2025-01-15' }), txn({ amount: 7000, txn_date: '2025-03-01' })],
    { refDate: ref, anniversaryDate: new Date('2020-02-10T00:00:00Z') },
  );
  assert.equal(p.eligibleSpend, 7000);
  assert.equal(p.period.start, '2025-02-10');
});

test('fee waiver unlocks reward equal to annual fee', () => {
  const b = benefit({ calc_method: 'fee_waiver', threshold_amount: 100000, include_all: 1, period_type: 'anniversary_year', requires_anniversary: 1 });
  const p = evaluateBenefit(b, [txn({ amount: 100000 })], { refDate: ref, annualFee: 1000, anniversaryDate: new Date('2020-02-10T00:00:00Z') });
  assert.equal(p.status, 'earned');
  assert.equal(p.earnedValue, 1000);
});

test('expired benefit is flagged', () => {
  const b = benefit({ effective_until: '2025-05-01', include_all: 1, calc_method: 'cashback_percent', reward_value: 1 });
  const p = evaluateBenefit(b, [txn({ amount: 1000 })], { refDate: ref });
  assert.equal(p.status, 'expired');
});
