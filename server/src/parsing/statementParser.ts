import { parseIndianAmount } from '../lib/money.ts';

export interface ParsedTxn {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive magnitude
  direction: 'debit' | 'credit';
  raw: string;
  confidence: number;
  warnings: string[];
}

export interface ParseResult {
  statementDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: ParsedTxn[];
  candidateLines: number;
  matchedLines: number;
  confidence: number;
  warnings: string[];
  likelyScanned: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function buildDate(d: number, m: number, y: number): string | null {
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDateToken(s: string): string | null {
  let m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s.trim());
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    // Indian statements default to DD/MM; disambiguate when possible.
    if (a > 12 && b <= 12) return buildDate(a, b, y);
    if (b > 12 && a <= 12) return buildDate(b, a, y);
    return buildDate(a, b, y);
  }
  m = /^(\d{1,2})[\s\-]+([A-Za-z]{3,9})[\s\-,]+(\d{2,4})$/.exec(s.trim());
  if (m) {
    const d = Number(m[1]);
    const mon = MONTHS[m[2]!.toLowerCase()];
    const y = Number(m[3]);
    if (mon) return buildDate(d, mon, y);
  }
  m = /^([A-Za-z]{3,9})[\s\-]+(\d{1,2})[\s\-,]+(\d{2,4})$/.exec(s.trim());
  if (m) {
    const mon = MONTHS[m[1]!.toLowerCase()];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mon) return buildDate(d, mon, y);
  }
  return null;
}

const DATE_AT_START = /^(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[\s\-]+[A-Za-z]{3,9}[\s\-,]+\d{2,4}|[A-Za-z]{3,9}[\s\-]+\d{1,2}[\s\-,]+\d{2,4})\b/;

const AMOUNT_AT_END = /([\d][\d,]{0,15}\.\d{2})\s*(cr|dr)?\s*[)]?$/i;

function findDateAtStart(line: string): { date: string; rest: string } | null {
  const m = DATE_AT_START.exec(line.trim());
  if (!m) return null;
  const dt = parseDateToken(m[1]!);
  if (!dt) return null;
  return { date: dt, rest: line.trim().slice(m[1]!.length).trim() };
}

function findAmountAtEnd(line: string): { amount: number; direction: 'debit' | 'credit' | null; rest: string } | null {
  const m = AMOUNT_AT_END.exec(line.trim());
  if (!m) return null;
  const amount = parseIndianAmount(m[1]!);
  if (amount === null) return null;
  const suffix = (m[2] ?? '').toLowerCase();
  const direction = suffix === 'cr' ? 'credit' : suffix === 'dr' ? 'debit' : null;
  const rest = line.trim().slice(0, m.index).trim();
  return { amount: Math.abs(amount), direction, rest };
}

interface Pending {
  date: string;
  parts: string[];
  rawParts: string[];
  amount: number | null;
  direction: 'debit' | 'credit' | null;
}

const PAYMENT_MARKERS = ['PAYMENT RECEIVED', 'PAYMENT THANK YOU', 'NET BANKING', 'NETBANKING', 'AUTOPAY', 'MANDATE', 'BANK CREDIT'];

function inferDirection(description: string, explicit: 'debit' | 'credit' | null): 'debit' | 'credit' {
  if (explicit) return explicit;
  const d = description.toUpperCase();
  if (PAYMENT_MARKERS.some((k) => d.includes(k))) return 'credit';
  return 'debit';
}

export function parseStatementText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const warnings: string[] = [];
  const transactions: ParsedTxn[] = [];

  let candidateLines = 0;
  let matchedLines = 0;

  let statementDate: string | null = null;
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  // Header extraction
  const flat = text.replace(/\s+/g, ' ');
  const DATE_TOKEN = String.raw`(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[\s\-]+[A-Za-z]{3,9}[\s\-,]+\d{2,4})`;
  const periodRe = new RegExp(
    String.raw`(?:statement|billing)\s*(?:period|cycle)\s*[:\-]?\s*${DATE_TOKEN}\s*(?:to|through|-|–|—)\s*${DATE_TOKEN}`,
    'i',
  );
  const periodM = periodRe.exec(flat);
  if (periodM) {
    periodStart = parseDateToken(periodM[1]!.trim()) ?? null;
    periodEnd = parseDateToken(periodM[2]!.trim()) ?? null;
  }
  const stmtDateRe = new RegExp(String.raw`statement\s*date\s*[:\-]?\s*${DATE_TOKEN}`, 'i');
  const stmtM = stmtDateRe.exec(flat);
  if (stmtM) statementDate = parseDateToken(stmtM[1]!.trim()) ?? null;

  let pending: Pending | null = null;

  const flush = () => {
    if (!pending) return;
    if (pending.amount !== null) {
      const description = pending.parts.join(' ').replace(/\s+/g, ' ').trim();
      const raw = pending.rawParts.join(' ').replace(/\s+/g, ' ').trim();
      const direction = inferDirection(description, pending.direction);
      const txnWarnings: string[] = [];
      const conf = pending.direction ? 0.95 : 0.8;
      transactions.push({
        date: pending.date,
        description,
        amount: pending.amount,
        direction,
        raw,
        confidence: conf,
        warnings: txnWarnings,
      });
      matchedLines++;
    }
    pending = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const hasAmountToken = AMOUNT_AT_END.test(line);
    if (hasAmountToken) candidateLines++;

    const dateStart = findDateAtStart(line);
    const amountEnd = findAmountAtEnd(line);

    if (dateStart && amountEnd) {
      flush();
      const withoutDate = findDateAtStart(amountEnd.rest)?.rest ?? amountEnd.rest;
      const description = withoutDate.replace(/^[\s|:-]+/, '').replace(/[\s|]+$/, '');
      transactions.push({
        date: dateStart.date,
        description,
        amount: amountEnd.amount,
        direction: inferDirection(description, amountEnd.direction),
        raw: line,
        confidence: amountEnd.direction ? 0.95 : 0.8,
        warnings: [],
      });
      matchedLines++;
      continue;
    }

    if (dateStart && !amountEnd) {
      flush();
      pending = {
        date: dateStart.date,
        parts: dateStart.rest ? [dateStart.rest] : [],
        rawParts: [line],
        amount: null,
        direction: null,
      };
      continue;
    }

    if (!dateStart && pending) {
      if (amountEnd) {
        // amounts ending the wrapped description
        pending.parts.push(amountEnd.rest);
        pending.rawParts.push(line);
        pending.amount = amountEnd.amount;
        pending.direction = amountEnd.direction;
        flush();
        continue;
      }
      // Continuation line: stop if it looks like a section header or footer
      if (/^(total|sub\s*total|minimum|amount due|payment due|reward|closing)/i.test(line)) {
        continue;
      }
      pending.parts.push(line);
      pending.rawParts.push(line);
      continue;
    }
  }
  flush();

  if (transactions.length === 0) warnings.push('No transactions were recognized. The PDF may be scanned or use an unsupported layout.');
  const confidence = candidateLines > 0 ? Math.min(1, matchedLines / candidateLines) : 0;

  return {
    statementDate,
    periodStart,
    periodEnd,
    transactions,
    candidateLines,
    matchedLines,
    confidence,
    warnings,
    likelyScanned: false,
  };
}
