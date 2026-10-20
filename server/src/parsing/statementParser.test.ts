import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatementText, parseDateToken } from './statementParser.ts';

test('parses date tokens in several formats', () => {
  assert.equal(parseDateToken('05/04/2026'), '2026-04-05');
  assert.equal(parseDateToken('5-4-26'), '2026-04-05');
  assert.equal(parseDateToken('15 Jan 2025'), '2025-01-15');
  assert.equal(parseDateToken('03 Apr 2026'), '2026-04-03');
});

test('disambiguates dd/mm vs mm/dd when day > 12', () => {
  assert.equal(parseDateToken('25/04/2026'), '2026-04-25');
});

const SAMPLE = `HDFC Bank Credit Card Statement
Statement Period: 01/04/2026 to 30/04/2026
Statement Date: 05/05/2026

Date        Transaction Description                         Amount
--------------------------------------------------------------------------
02/04/2026  AMAZON INDIA MARKETPLACE REF 8821345             4,999.00
05/04/2026  SWIGGY INSTAMART BANGALORE                       1,245.50
25/04/2026  PAYMENT RECEIVED - THANK YOU                     5,000.00 Cr
30/04/2026  LATE PAYMENT CHARGES                               500.00
--------------------------------------------------------------------------
Total Amount Due: 6744.50
Minimum Amount Due: 5,000.00`;

test('parses statement header and transactions', () => {
  const r = parseStatementText(SAMPLE);
  assert.equal(r.periodStart, '2026-04-01');
  assert.equal(r.periodEnd, '2026-04-30');
  assert.equal(r.statementDate, '2026-05-05');
  assert.equal(r.transactions.length, 4);
});

test('infers credit direction from Cr suffix', () => {
  const r = parseStatementText(SAMPLE);
  const payment = r.transactions.find((t) => t.description.includes('PAYMENT RECEIVED'));
  assert.ok(payment);
  assert.equal(payment!.direction, 'credit');
  assert.equal(payment!.amount, 5000);
});

test('captures debit amounts with indian comma grouping', () => {
  const r = parseStatementText(SAMPLE);
  const amazon = r.transactions.find((t) => t.description.startsWith('AMAZON'));
  assert.ok(amazon);
  assert.equal(amazon!.amount, 4999);
  assert.equal(amazon!.direction, 'debit');
  assert.equal(amazon!.date, '2026-04-02');
});

test('joins wrapped description lines', () => {
  const wrapped = `Statement Period: 01/04/2026 to 30/04/2026
02/04/2026  AMAZON INDIA
            MARKETPLACE BANGALORE     4,999.00
`;
  const r = parseStatementText(wrapped);
  assert.equal(r.transactions.length, 1);
  assert.match(r.transactions[0]!.description, /MARKETPLACE/);
  assert.equal(r.transactions[0]!.amount, 4999);
});

test('reports no transactions for empty text', () => {
  const r = parseStatementText('This is not a statement.');
  assert.equal(r.transactions.length, 0);
  assert.ok(r.warnings.length > 0);
});
