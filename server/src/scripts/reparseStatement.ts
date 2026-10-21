/**
 * Re-parse a stored statement's raw text (kept in statements.raw_text) and
 * replace its transactions in place. Useful when the parser has improved
 * since the statement was imported and the source PDF is unavailable.
 *
 * Usage:
 *   npx tsx src/scripts/reparseStatement.ts <statementId>
 */
import { migrate, all, get, insert, run } from '../db.ts';
import { parseStatementText } from '../parsing/statementParser.ts';
import { normalizeParsedTxn } from '../normalize/normalize.ts';
import { getRules } from '../services/statements.ts';

migrate();

const statementId = Number(process.argv[2]);
if (!Number.isInteger(statementId)) {
  console.error('Usage: npx tsx src/scripts/reparseStatement.ts <statementId>');
  process.exit(1);
}

interface StatementRow {
  id: number;
  user_card_id: number;
  filename: string;
  raw_text: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  statement_date: string | null;
}

const stmt = get<StatementRow>(
  'SELECT id, user_card_id, filename, raw_text, billing_period_start, billing_period_end, statement_date FROM statements WHERE id = ?',
  statementId,
);
if (!stmt) {
  console.error(`Statement ${statementId} not found`);
  process.exit(1);
}
if (!stmt.raw_text) {
  console.error(`Statement ${statementId} has no stored raw_text`);
  process.exit(1);
}

const parsed = parseStatementText(stmt.raw_text);
const rules = getRules();
const normalized = parsed.transactions.map((p) => normalizeParsedTxn(p, stmt.user_card_id, rules));

console.log(`Parsed ${normalized.length} transaction(s), confidence ${parsed.confidence}`);
for (const n of normalized) {
  console.log(
    `  ${n.txn_date} ${n.direction.padEnd(6)} ${n.amount.toFixed(2).padStart(10)}  ${n.txn_type.padEnd(8)}  ${n.category.padEnd(16)} ${n.merchant}`,
  );
}
if (normalized.length === 0) {
  console.error('Refusing to replace existing data with an empty parse.');
  process.exit(1);
}

const seen = new Set(
  all<{ dedupe_hash: string }>('SELECT dedupe_hash FROM transactions WHERE statement_id != ?', statementId).map(
    (r) => r.dedupe_hash,
  ),
);

run('DELETE FROM transactions WHERE statement_id = ?', statementId);

let imported = 0;
let duplicates = 0;
for (const n of normalized) {
  if (seen.has(n.dedupe_hash)) {
    duplicates++;
    continue;
  }
  seen.add(n.dedupe_hash);
  insert(
    `INSERT INTO transactions (user_card_id, statement_id, txn_date, description, merchant, amount, direction, txn_type, category, category_source, confidence, is_excluded, exclusion_reason, dedupe_hash, source_file)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    stmt.user_card_id,
    statementId,
    n.txn_date,
    n.description,
    n.merchant,
    n.amount,
    n.direction,
    n.txn_type,
    n.category,
    n.category_source,
    n.confidence,
    n.is_excluded,
    n.exclusion_reason,
    n.dedupe_hash,
    stmt.filename,
  );
  imported++;
}

run(
  `UPDATE statements SET parse_confidence = ?, imported_count = ?, duplicate_count = ?,
     billing_period_start = ?, billing_period_end = ?, statement_date = ? WHERE id = ?`,
  parsed.confidence,
  imported,
  duplicates,
  parsed.periodStart ?? stmt.billing_period_start,
  parsed.periodEnd ?? stmt.billing_period_end,
  parsed.statementDate ?? stmt.statement_date,
  statementId,
);

console.log(`Statement ${statementId}: imported ${imported}, duplicates skipped ${duplicates}`);
