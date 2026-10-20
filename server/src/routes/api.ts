import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { config } from '../config.ts';
import { all, get, insert, run } from '../db.ts';
import { getCatalogCard, listCatalog, listIssuers } from '../services/catalog.ts';
import {
  commitPendingImport,
  createUserCard,
  deleteStatement,
  deleteUserCard,
  discardPendingImport,
  getPendingImport,
  listStatements,
  parseAndStage,
} from '../services/statements.ts';
import { buildPortfolio, getCardBenefits, getRecommendations, listUserCards } from '../services/analytics.ts';
import { CATEGORIES, CATEGORY_LABELS, TXN_TYPES } from '../lib/categories.ts';
import { checkSource } from '../sources/provider.ts';
import { CARDADVISOR_ATTRIBUTION, fetchMeta } from '../sources/cardadvisor.ts';
import { PdfPasswordError } from '../parsing/pdf.ts';

export const api = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(null, ok);
  },
});

function ah(fn: (req: Request, res: Response) => Promise<unknown> | unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = fn(req, res);
      if (r && typeof (r as Promise<unknown>).catch === 'function') (r as Promise<unknown>).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function profileId(): number {
  const row = get<{ id: number }>('SELECT id FROM profiles ORDER BY id LIMIT 1');
  return row?.id ?? 1;
}

// ---- profile ----
api.get('/profile', ah((_req, res) => {
  res.json(get('SELECT * FROM profiles ORDER BY id LIMIT 1') ?? null);
}));

api.post('/profile', ah((req, res) => {
  const name = String(req.body?.name ?? '').trim() || 'Local User';
  const existing = get<{ id: number }>('SELECT id FROM profiles ORDER BY id LIMIT 1');
  if (existing) {
    run('UPDATE profiles SET name = ? WHERE id = ?', name, existing.id);
    res.json({ id: existing.id, name });
  } else {
    const id = insert('INSERT INTO profiles (name) VALUES (?)', name);
    res.json({ id, name });
  }
}));

// ---- meta ----
api.get('/meta', ah((_req, res) => {
  res.json({
    categories: CATEGORIES,
    categoryLabels: CATEGORY_LABELS,
    txnTypes: TXN_TYPES,
    tiers: ['entry', 'mid', 'premium', 'super_premium', 'secured'],
    authMode: config.authMode,
    enableAi: config.enableAi,
  });
}));

// ---- card catalogue ----
api.get('/cards', ah((req, res) => {
  res.json(listCatalog({
    search: req.query.search ? String(req.query.search) : undefined,
    issuer: req.query.issuer ? String(req.query.issuer) : undefined,
    tier: req.query.tier ? String(req.query.tier) : undefined,
  }));
}));

api.get('/issuers', ah((_req, res) => res.json(listIssuers())));

api.get('/cards/:id', ah((req, res) => {
  const card = getCatalogCard(Number(req.params.id));
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
}));

// ---- user cards ----
api.get('/user-cards', ah((_req, res) => res.json(listUserCards())));

api.post('/user-cards', ah((req, res) => {
  const body = req.body ?? {};
  const id = createUserCard({
    profileId: profileId(),
    cardProductId: body.cardProductId ? Number(body.cardProductId) : undefined,
    nickname: body.nickname ?? undefined,
    last4: body.last4 ?? undefined,
    issuedOn: body.issuedOn ?? undefined,
    anniversaryDate: body.anniversaryDate ?? undefined,
    customCard: body.customCard ?? undefined,
  });
  res.status(201).json({ id });
}));

api.patch('/user-cards/:id', ah((req, res) => {
  const id = Number(req.params.id);
  const body = req.body ?? {};
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const key of ['nickname', 'last4', 'issued_on', 'anniversary_date'] as const) {
    const camel = key.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
    if (body[camel] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(body[camel]);
    }
  }
  if (fields.length) run(`UPDATE user_cards SET ${fields.join(', ')} WHERE id = ?`, ...params, id);
  res.json({ ok: true });
}));

api.delete('/user-cards/:id', ah((req, res) => {
  deleteUserCard(Number(req.params.id));
  res.json({ ok: true });
}));

// ---- statements ----
api.get('/statements', ah((req, res) => {
  res.json(listStatements(req.query.cardId ? Number(req.query.cardId) : undefined));
}));

api.post('/statements/upload', upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A PDF file is required (field name: file).' });
  const userCardId = Number(req.body?.userCardId);
  if (!userCardId) return res.status(400).json({ error: 'userCardId is required.' });
  const password = typeof req.body?.password === 'string' && req.body.password ? req.body.password : undefined;
  let pending;
  try {
    pending = await parseAndStage(userCardId, req.file.originalname, req.file.buffer, password);
  } catch (err) {
    if (err instanceof PdfPasswordError) {
      return res.status(422).json({ error: err.message, needsPassword: err.needsPassword });
    }
    throw err;
  }
  res.json({
    pendingId: pending.id,
    fileName: pending.filename,
    statementDate: pending.statementDate,
    periodStart: pending.periodStart,
    periodEnd: pending.periodEnd,
    parseConfidence: pending.parseConfidence,
    importedCount: pending.importedCount,
    duplicateCount: pending.duplicateCount,
    skippedCount: pending.skippedCount,
    warnings: pending.warnings,
    likelyScanned: pending.likelyScanned,
    transactions: pending.transactions,
  });
}));

api.get('/statements/pending/:id', ah((req, res) => {
  const p = getPendingImport(Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Pending import not found' });
  res.json(p);
}));

api.post('/statements/pending/:id/commit', ah((req, res) => {
  res.json(commitPendingImport(Number(req.params.id)));
}));

api.delete('/statements/pending/:id', ah((req, res) => {
  discardPendingImport(Number(req.params.id));
  res.json({ ok: true });
}));

api.delete('/statements/:id', ah((req, res) => {
  deleteStatement(Number(req.params.id));
  res.json({ ok: true });
}));

// ---- transactions ----
api.get('/transactions', ah((req, res) => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (req.query.cardId) { where.push('t.user_card_id = ?'); params.push(Number(req.query.cardId)); }
  if (req.query.month) { where.push('t.txn_date LIKE ?'); params.push(`${String(req.query.month)}%`); }
  if (req.query.category) { where.push('t.category = ?'); params.push(String(req.query.category)); }
  if (req.query.txnType) { where.push('t.txn_type = ?'); params.push(String(req.query.txnType)); }
  if (req.query.merchant) { where.push('t.merchant LIKE ?'); params.push(`%${String(req.query.merchant)}%`); }
  if (req.query.search) { where.push('(t.description LIKE ? OR t.merchant LIKE ?)'); params.push(`%${String(req.query.search)}%`, `%${String(req.query.search)}%`); }
  if (req.query.eligible === 'true') { where.push("t.direction = 'debit' AND t.txn_type = 'purchase'"); }
  if (req.query.eligible === 'false') { where.push("(t.direction = 'credit' OR t.txn_type != 'purchase')"); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const offset = Number(req.query.offset) || 0;

  const rows = all<Record<string, unknown>>(
    `SELECT t.id, t.user_card_id AS userCardId, t.txn_date AS txnDate, t.posted_date AS postedDate,
            t.description, t.merchant, t.amount, t.direction, t.txn_type AS txnType, t.category,
            t.category_source AS categorySource, t.confidence, t.is_excluded AS isExcluded,
            t.exclusion_reason AS exclusionReason, t.source_file AS sourceFile,
            uc.nickname AS cardNickname, cp.name AS cardName, cp.id AS cardProductId
     FROM transactions t
     JOIN user_cards uc ON uc.id = t.user_card_id
     JOIN card_products cp ON cp.id = uc.card_product_id
     ${clause}
     ORDER BY t.txn_date DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    ...params, limit, offset,
  );

  // annotate which benefit rules each transaction's category is eligible for
  const benefitCache = new Map<number, { name: string; includeAll: number; eligible: string[]; excluded: string[] }[]>();
  for (const r of rows) {
    const cpId = Number(r.cardProductId);
    if (!benefitCache.has(cpId)) {
      const b = getCardBenefits(cpId);
      benefitCache.set(cpId, b.map((x) => ({
        name: x.name,
        includeAll: x.include_all,
        eligible: safeList(x.eligible_categories),
        excluded: safeList(x.excluded_categories),
      })));
    }
    const cat = String(r.category);
    const eligibleFor = (benefitCache.get(cpId) ?? [])
      .filter((b) => (b.includeAll ? !b.excluded.includes(cat) : b.eligible.includes(cat)))
      .map((b) => b.name);
    r.eligibleFor = eligibleFor;
    r.spendEligible = r.direction === 'debit' && r.txnType === 'purchase';
  }

  res.json({ transactions: rows, count: rows.length });
}));

api.patch('/transactions/:id', ah((req, res) => {
  const id = Number(req.params.id);
  const existing = get<Record<string, unknown>>('SELECT * FROM transactions WHERE id = ?', id);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });
  const body = req.body ?? {};
  const map: Record<string, string> = { category: 'category', merchant: 'merchant', description: 'description', txnType: 'txn_type' };
  for (const [key, col] of Object.entries(map)) {
    if (body[key] !== undefined) {
      insert('INSERT INTO user_overrides (transaction_id, field, old_value, new_value) VALUES (?,?,?,?)', id, col, String(existing[col] ?? ''), String(body[key]));
      const extra = key === 'category' ? ", category_source = 'manual'" : '';
      run(`UPDATE transactions SET ${col} = ?${extra} WHERE id = ?`, body[key], id);
    }
  }
  res.json({ ok: true });
}));

// ---- benefits ----
api.get('/benefits', ah((req, res) => {
  const cardId = req.query.userCardId ? Number(req.query.userCardId) : undefined;
  if (cardId) {
    const uc = get<{ card_product_id: number }>('SELECT card_product_id FROM user_cards WHERE id = ?', cardId);
    if (!uc) return res.status(404).json({ error: 'Card not found' });
    return res.json(getCardBenefits(uc.card_product_id));
  }
  const portfolio = buildPortfolio({ period: 'all' });
  const all2 = new Map<number, unknown>();
  for (const c of portfolio.cards) for (const p of c.progress) all2.set(p.benefitId, p);
  res.json([...all2.values()]);
}));

api.get('/benefits/progress', ah((req, res) => {
  const period = req.query.period ? String(req.query.period) : undefined;
  const portfolio = buildPortfolio({ period });
  res.json({
    period: portfolio.overview.period,
    cards: portfolio.cards.map((c) => ({
      card: c.card,
      eligibleSpend: c.eligibleSpend,
      totalSpend: c.totalSpend,
      earnedValue: c.earnedValue,
      progress: c.progress,
    })),
  });
}));

// ---- overview + recommendations ----
api.get('/overview', ah((req, res) => {
  const portfolio = buildPortfolio({ period: req.query.period ? String(req.query.period) : undefined });
  res.json(portfolio);
}));

api.get('/recommendations', ah((req, res) => {
  res.json(getRecommendations(req.query.period ? String(req.query.period) : undefined));
}));

// ---- sources ----
api.get('/sources/status', ah(async (_req, res) => {
  const sources = all(`SELECT s.*, 
    (SELECT checked_at FROM source_checks c WHERE c.source_id = s.id ORDER BY checked_at DESC LIMIT 1) AS lastChecked,
    (SELECT status FROM source_checks c WHERE c.source_id = s.id ORDER BY checked_at DESC LIMIT 1) AS lastStatus
    FROM sources s ORDER BY s.kind, s.name`);

  let availability = 'unknown';
  let note = 'Availability not checked.';
  let meta: unknown = null;
  try {
    meta = await fetchMeta();
    availability = 'ok';
    note = 'Endpoint reachable. Anonymous facts tier; the open dataset at /data/cards.json needs no key.';
  } catch (err) {
    availability = 'unavailable';
    note = err instanceof Error ? err.message : String(err);
  }

  res.json({
    sources,
    cardadvisor: {
      url: config.cardadvisor.datasetUrl,
      openapi: 'https://cardadvisor.in/openapi.json',
      developers: 'https://cardadvisor.in/developers',
      attribution: CARDADVISOR_ATTRIBUTION,
      keyed: config.cardadvisor.apiKey != null,
      availability,
      note,
      meta,
    },
  });
}));

api.post('/sources/check', ah(async (req, res) => {
  const id = req.body?.sourceId ? Number(req.body.sourceId) : undefined;
  const sources = id
    ? all<{ id: number; url: string }>('SELECT id, url FROM sources WHERE id = ?', id)
    : all<{ id: number; url: string }>('SELECT id, url FROM sources');
  const results = [];
  for (const s of sources) {
    const r = await checkSource(s.url);
    insert('INSERT INTO source_checks (source_id, checked_at, status, http_status, notes) VALUES (?,datetime(\'now\'),?,?,?)', s.id, r.status, r.httpStatus ?? null, r.notes ?? null);
    run('UPDATE sources SET status = ?, last_checked_at = datetime(\'now\') WHERE id = ?', r.status, s.id);
    results.push({ sourceId: s.id, url: s.url, ...r });
  }
  res.json({ results });
}));

function safeList(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
