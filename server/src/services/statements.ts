import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { all, get, insert, run } from '../db.ts';
import { config } from '../config.ts';
import { extractPdfText } from '../parsing/pdf.ts';
import { parseStatementText } from '../parsing/statementParser.ts';
import { normalizeParsedTxn, type NormalizedTxn } from '../normalize/normalize.ts';
import { DEFAULT_RULES, type Rule } from '../categorize/categorizer.ts';

export function getRules(): Rule[] {
  const rows = all<{ pattern: string; category: string; priority: number }>(
    'SELECT pattern, category, priority FROM merchant_rules ORDER BY priority',
  );
  if (rows.length === 0) return DEFAULT_RULES;
  return rows.map((r) => ({ pattern: r.pattern, category: r.category as Rule['category'], priority: r.priority }));
}

export interface CreateCardInput {
  profileId: number;
  cardProductId?: number;
  nickname?: string;
  last4?: string;
  issuedOn?: string;
  anniversaryDate?: string;
  customCard?: { issuerName: string; name: string; variant?: string };
}

export function createUserCard(input: CreateCardInput): number {
  let cardProductId = input.cardProductId;
  if (!cardProductId && input.customCard) {
    const issuerName = input.customCard.issuerName || 'Other';
    const issuerSlug = issuerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let issuer = get<{ id: number }>('SELECT id FROM issuers WHERE slug = ?', issuerSlug);
    if (!issuer) issuer = { id: insert('INSERT INTO issuers (name, slug) VALUES (?, ?)', issuerName, issuerSlug) };
    const baseSlug = `custom-${input.customCard.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
    cardProductId = insert(
      `INSERT INTO card_products (issuer_id, slug, name, variant, tier, official_url, data_confidence, verification_status, notes, is_custom)
       VALUES (?,?,?,?,?,?,?,?,?,1)`,
      issuer.id,
      baseSlug,
      input.customCard.name,
      input.customCard.variant ?? null,
      'mid',
      null,
      'unverified',
      'unverified',
      'Manually added card — benefits unverified until configured.',
    );
  }
  if (!cardProductId) throw new Error('Either cardProductId or customCard is required');

  return insert(
    'INSERT INTO user_cards (profile_id, card_product_id, nickname, last4, issued_on, anniversary_date) VALUES (?,?,?,?,?,?)',
    input.profileId,
    cardProductId,
    input.nickname ?? null,
    input.last4 ?? null,
    input.issuedOn ?? null,
    input.anniversaryDate ?? null,
  );
}

export function deleteUserCard(id: number) {
  run('DELETE FROM user_cards WHERE id = ?', id);
}

export interface StagedTransaction extends NormalizedTxn {
  isDuplicate: boolean;
  duplicateOf?: number;
}

export interface PendingImport {
  id: number;
  userCardId: number;
  filename: string;
  fileHash: string;
  statementDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  parseConfidence: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  warnings: string[];
  likelyScanned: boolean;
  transactions: StagedTransaction[];
  rawText?: string;
}

function validatePdf(buffer: Buffer) {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('File is not a valid PDF (missing %PDF header).');
  }
}

export async function parseAndStage(userCardId: number, filename: string, buffer: Buffer, password?: string): Promise<PendingImport> {
  validatePdf(buffer);
  const card = get<{ id: number }>('SELECT id FROM user_cards WHERE id = ?', userCardId);
  if (!card) throw new Error('Card not found');

  const fileHash = createHash('sha256').update(buffer).digest('hex');
  const extracted = await extractPdfText(buffer, password);
  const parsed = parseStatementText(extracted.text);
  parsed.likelyScanned = extracted.likelyScanned;

  if (extracted.likelyScanned) {
    parsed.warnings.push('Very little text was extracted — OCR fallback is not enabled in V1. This may be a scanned statement.');
  }

  const rules = getRules();
  const existing = all<{ id: number; dedupe_hash: string }>(
    'SELECT id, dedupe_hash FROM transactions WHERE user_card_id = ?',
    userCardId,
  );
  const existingMap = new Map(existing.map((e) => [e.dedupe_hash, e.id]));
  const batchHashes = new Set<string>();

  let duplicates = 0;
  let skipped = 0;
  const staged: StagedTransaction[] = [];
  for (const p of parsed.transactions) {
    const norm = normalizeParsedTxn(p, userCardId, rules);
    if (norm.amount <= 0) {
      skipped++;
      continue;
    }
    let isDuplicate = false;
    if (batchHashes.has(norm.dedupe_hash) || existingMap.has(norm.dedupe_hash)) {
      isDuplicate = true;
      duplicates++;
    }
    batchHashes.add(norm.dedupe_hash);
    staged.push({
      ...norm,
      isDuplicate,
      duplicateOf: existingMap.get(norm.dedupe_hash),
    });
  }

  // Persist the raw PDF privately for re-parsing / deletion (never publicly served).
  const storedName = `${fileHash.slice(0, 16)}.pdf`;
  const storedPath = path.join(config.filesDir, storedName);
  if (!fs.existsSync(storedPath)) fs.writeFileSync(storedPath, buffer);

  const summary: PendingImport = {
    id: 0,
    userCardId,
    filename,
    fileHash,
    statementDate: parsed.statementDate,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    parseConfidence: Math.round(parsed.confidence * 100) / 100,
    importedCount: staged.filter((t) => !t.isDuplicate).length,
    duplicateCount: duplicates,
    skippedCount: skipped,
    warnings: parsed.warnings,
    likelyScanned: parsed.likelyScanned,
    transactions: staged,
    rawText: extracted.text.slice(0, 20000),
  };

  const id = insert(
    'INSERT INTO pending_imports (user_card_id, filename, file_hash, parsed_json) VALUES (?,?,?,?)',
    userCardId,
    filename,
    fileHash,
    JSON.stringify(summary),
  );
  summary.id = id;
  return summary;
}

export function getPendingImport(id: number): PendingImport | null {
  const row = get<{ parsed_json: string }>('SELECT parsed_json FROM pending_imports WHERE id = ?', id);
  if (!row) return null;
  return JSON.parse(row.parsed_json) as PendingImport;
}

export function discardPendingImport(id: number) {
  run('DELETE FROM pending_imports WHERE id = ?', id);
}

export function commitPendingImport(id: number): { statementId: number; imported: number; duplicates: number } {
  const pending = getPendingImport(id);
  if (!pending) throw new Error('Pending import not found');

  const statementId = insert(
    `INSERT INTO statements (user_card_id, filename, file_hash, billing_period_start, billing_period_end, statement_date, parse_confidence, status, imported_count, duplicate_count, skipped_count, raw_text)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    pending.userCardId,
    pending.filename,
    pending.fileHash,
    pending.periodStart,
    pending.periodEnd,
    pending.statementDate,
    pending.parseConfidence,
    'imported',
    0,
    pending.duplicateCount,
    pending.skippedCount,
    pending.rawText ?? null,
  );

  let imported = 0;
  for (const t of pending.transactions) {
    if (t.isDuplicate) continue;
    insert(
      `INSERT INTO transactions (user_card_id, statement_id, txn_date, description, merchant, amount, direction, txn_type, category, category_source, confidence, is_excluded, exclusion_reason, dedupe_hash, source_file)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      pending.userCardId,
      statementId,
      t.txn_date,
      t.description,
      t.merchant,
      t.amount,
      t.direction,
      t.txn_type,
      t.category,
      t.category_source,
      t.confidence,
      t.is_excluded,
      t.exclusion_reason,
      t.dedupe_hash,
      pending.filename,
    );
    imported++;
  }

  run('UPDATE statements SET imported_count = ? WHERE id = ?', imported, statementId);
  run('DELETE FROM pending_imports WHERE id = ?', id);
  return { statementId, imported, duplicates: pending.duplicateCount };
}

export function listStatements(cardId?: number) {
  const clause = cardId ? 'WHERE s.user_card_id = ?' : '';
  const params = cardId ? [cardId] : [];
  return all(
    `SELECT s.*, uc.nickname AS cardNickname, cp.name AS cardName
     FROM statements s
     JOIN user_cards uc ON uc.id = s.user_card_id
     JOIN card_products cp ON cp.id = uc.card_product_id
     ${clause} ORDER BY s.created_at DESC`,
    ...params,
  );
}

export function deleteStatement(id: number) {
  const stmt = get<{ file_hash: string }>('SELECT file_hash FROM statements WHERE id = ?', id);
  run('DELETE FROM statements WHERE id = ?', id); // cascades transactions
  if (stmt) {
    const storedPath = path.join(config.filesDir, `${stmt.file_hash.slice(0, 16)}.pdf`);
    if (fs.existsSync(storedPath)) fs.rmSync(storedPath, { force: true });
  }
}
