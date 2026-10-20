import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPeriod, ymd } from './periods.ts';

const d = (s: string) => new Date(`${s}T00:00:00Z`);

test('calendar year period', () => {
  const p = getPeriod('calendar_year', d('2025-06-15'));
  assert.equal(p.start, '2025-01-01');
  assert.equal(p.end, '2025-12-31');
  assert.equal(p.nextReset, '2026-01-01');
});

test('indian financial year period (Apr-Mar)', () => {
  const p1 = getPeriod('financial_year', d('2025-06-15'));
  assert.equal(p1.start, '2025-04-01');
  assert.equal(p1.end, '2026-03-31');
  const p2 = getPeriod('financial_year', d('2025-02-15'));
  assert.equal(p2.start, '2024-04-01');
  assert.equal(p2.end, '2025-03-31');
});

test('monthly period', () => {
  const p = getPeriod('monthly', d('2025-06-15'));
  assert.equal(p.start, '2025-06-01');
  assert.equal(p.end, '2025-06-30');
  assert.equal(p.nextReset, '2025-07-01');
});

test('quarterly period', () => {
  const p = getPeriod('quarterly', d('2025-05-02'));
  assert.equal(p.start, '2025-04-01');
  assert.equal(p.end, '2025-06-30');
});

test('anniversary year uses card anniversary anchor', () => {
  const p = getPeriod('anniversary_year', d('2025-06-15'), d('2020-02-10'));
  assert.equal(p.start, '2025-02-10');
  assert.equal(p.end, '2026-02-09');
  assert.equal(p.basedOnAnniversary, true);
});

test('anniversary year falls back safely without anchor', () => {
  const p = getPeriod('anniversary_year', d('2025-06-15'), null);
  assert.equal(p.start, '2025-01-01');
  assert.equal(p.basedOnAnniversary, false);
});

test('rolling 12 month period', () => {
  const p = getPeriod('rolling_12m', d('2025-06-30'));
  assert.equal(p.end, '2025-06-30');
  assert.equal(p.start, '2024-07-01');
});

test('ymd formats with zero padding', () => {
  assert.equal(ymd(d('2025-01-05')), '2025-01-05');
});
