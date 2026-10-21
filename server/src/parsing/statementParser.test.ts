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

const ICICI_DOUBLED = `ICICI Bank Credit Card Statement
Statement Period: September 16, 2026 to October 15, 2026

Date Date SerNo. SerNo. Transaction Details Transaction Details Reward Points Reward Points International Amount International Amount Amount (in Amount (in\`) \` )
03/10/2026 03/10/2026 14280564039 14280564039 Autodebit Payment Recd. Autodebit Payment Recd. 0 0 R,VTS.AA 1276.67 CR CR
27/09/2026 27/09/2026 14280560001 14280560001 PTMRELIANCE RETAIL L NOIDA IN PTMRELIANCE RETAIL L NOIDA IN 8 8 715.83 YVZ.AA
01/10/2026 01/10/2026 14280563377 14280563377 PNBM2M FERRIES PRIVAT Mumbai IN PNBM2M FERRIES PRIVAT Mumbai IN 90 90 U,VAA.AA 3750.00
06/10/2026 06/10/2026 14280564966 14280564966 WWWWORKHUMANCOM DUBLIN IE* WWWWORKHUMANCOM DUBLIN IE* 46 46 12 USD 12 USD R,SAT.UY 1002.90
0000XXXXXXXX5314 0000XXXXXXXX5314
Total 6,562.48`;

test('parses ICICI doubled-text rows with trailing CR CR', () => {
  const r = parseStatementText(ICICI_DOUBLED);
  const payment = r.transactions.find((t) => t.description.includes('Autodebit Payment Recd.'));
  assert.ok(payment, 'autodebit payment row should be parsed');
  assert.equal(payment!.amount, 1276.67);
  assert.equal(payment!.direction, 'credit');
  assert.equal(payment!.date, '2026-10-03');
});

test('parses ICICI rows with a trailing reward code after the amount', () => {
  const r = parseStatementText(ICICI_DOUBLED);
  const retail = r.transactions.find((t) => t.description.includes('RELIANCE RETAIL'));
  assert.ok(retail, 'row ending in "715.83 YVZ.AA" should be parsed');
  assert.equal(retail!.amount, 715.83);
  assert.equal(retail!.direction, 'debit');
  assert.equal(retail!.date, '2026-09-27');
});

test('does not create a phantom transaction from the payment due date line', () => {
  const text = `November 2, 2026 Scan to Pay using any UPI Application
Statement Summary
Total Amount due Previous Balance 6,562.48
Minimum Amount due 380.00`;
  const r = parseStatementText(text);
  assert.equal(r.transactions.length, 0, JSON.stringify(r.transactions));
});

test('a pending transaction still dies when summary lines never provide an amount', () => {
  const text = `01/10/2026 SOME WRAPPED DESCRIPTION FIRST LINE
second continuation line
third continuation line
fourth continuation line
fifth continuation line
sixth continuation line
seventh continuation line
eighth continuation line`;
  const r = parseStatementText(text);
  assert.equal(r.transactions.length, 0, JSON.stringify(r.transactions));
});
