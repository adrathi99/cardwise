import { DatabaseSync } from 'node:sqlite';
import { config } from './config.ts';

export const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function run(sql: string, ...params: unknown[]) {
  const stmt = db.prepare(sql);
  return stmt.run(...(params as never[]));
}

export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...(params as never[])) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...(params as never[])) as T | undefined;
}

export function insert(sql: string, ...params: unknown[]): number {
  const res = run(sql, ...params);
  return Number(res.lastInsertRowid);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS issuers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS card_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issuer_id INTEGER NOT NULL REFERENCES issuers(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  variant TEXT,
  network TEXT,
  tier TEXT,
  annual_fee REAL,
  fee_waiver_spend REAL,
  fee_waiver_period TEXT,
  reward_program TEXT,
  official_url TEXT,
  data_confidence TEXT NOT NULL DEFAULT 'unverified',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  verified_at TEXT,
  notes TEXT,
  is_custom INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS benefits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_product_id INTEGER NOT NULL REFERENCES card_products(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL,
  reward_value REAL,
  reward_points REAL,
  point_value_inr REAL,
  threshold_amount REAL,
  min_eligible_spend REAL,
  calc_method TEXT NOT NULL,
  include_all INTEGER NOT NULL DEFAULT 0,
  eligible_categories TEXT,
  excluded_categories TEXT,
  cap_amount REAL,
  cap_points REAL,
  period_type TEXT NOT NULL,
  period_start_rule TEXT,
  requires_anniversary INTEGER NOT NULL DEFAULT 0,
  requires_activation INTEGER NOT NULL DEFAULT 0,
  effective_from TEXT,
  effective_until TEXT,
  redemption_instructions TEXT,
  expiry_rules TEXT,
  source_url TEXT,
  source_label TEXT,
  verified_at TEXT,
  confidence TEXT NOT NULL DEFAULT 'unverified',
  status TEXT NOT NULL DEFAULT 'active',
  version INTEGER NOT NULL DEFAULT 1,
  supersedes_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  card_product_id INTEGER NOT NULL REFERENCES card_products(id),
  nickname TEXT,
  last4 TEXT,
  issued_on TEXT,
  anniversary_date TEXT,
  custom_benefits TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_card_id INTEGER NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  billing_period_start TEXT,
  billing_period_end TEXT,
  statement_date TEXT,
  parse_confidence REAL,
  status TEXT NOT NULL DEFAULT 'imported',
  imported_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  raw_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_card_id INTEGER NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  statement_id INTEGER REFERENCES statements(id) ON DELETE CASCADE,
  txn_date TEXT NOT NULL,
  posted_date TEXT,
  description TEXT NOT NULL,
  merchant TEXT,
  amount REAL NOT NULL,
  direction TEXT NOT NULL,
  txn_type TEXT NOT NULL,
  category TEXT NOT NULL,
  category_source TEXT NOT NULL DEFAULT 'rule',
  confidence REAL NOT NULL DEFAULT 0.5,
  is_excluded INTEGER NOT NULL DEFAULT 0,
  exclusion_reason TEXT,
  dedupe_hash TEXT,
  source_file TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS merchant_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'substring',
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS user_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reward_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_card_id INTEGER NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  benefit_id INTEGER REFERENCES benefits(id),
  kind TEXT NOT NULL,
  value_inr REAL,
  points REAL,
  status TEXT,
  noted_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  issuer_slug TEXT,
  last_checked_at TEXT,
  status TEXT NOT NULL DEFAULT 'known',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS source_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  checked_at TEXT NOT NULL,
  status TEXT NOT NULL,
  http_status INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS pending_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_card_id INTEGER NOT NULL REFERENCES user_cards(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  parsed_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_txn_card_date ON transactions(user_card_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_txn_dedupe ON transactions(dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_stmt_card ON statements(user_card_id);
`;

export function migrate() {
  db.exec(SCHEMA);
}
