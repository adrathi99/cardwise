/**
 * End-to-end smoke test against a running CARDWISE server.
 * Usage: npm run smoke  (server must be running on $PORT, default 8787)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(here, '../../../samples');
const base = `http://localhost:${process.env.PORT ?? 8787}/api`;

async function j<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function upload(userCardId: number, filePath: string) {
  const form = new FormData();
  form.append('userCardId', String(userCardId));
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/pdf' }), path.basename(filePath));
  const res = await fetch(`${base}/statements/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload -> ${res.status} ${await res.text()}`);
  return res.json() as Promise<any>;
}

const cards = await j<any[]>('GET', '/cards');
const card = cards.find((c) => c.slug === 'hdfc-millennia') ?? cards[0];
console.log(`Catalogue: ${cards.length} cards. Using "${card.name}" (confidence ${card.dataConfidence}).`);

const created = await j<{ id: number }>('POST', '/user-cards', {
  cardProductId: card.id,
  nickname: 'HDFC Millennia',
  anniversaryDate: '2021-06-01',
});
console.log(`Created user card #${created.id}`);

const sampleFiles = fs.existsSync(samplesDir)
  ? fs.readdirSync(samplesDir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
  : [];
if (sampleFiles.length === 0) throw new Error('No sample PDFs found. Run `npm run sample` first.');

for (const name of sampleFiles) {
  const file = path.join(samplesDir, name);
  const preview = await upload(created.id, file);
  console.log(`\n${name}: confidence ${preview.parseConfidence}, ${preview.transactions.length} txns parsed, ${preview.duplicateCount} dupes, ${preview.skippedCount} skipped, period ${preview.periodStart}..${preview.periodEnd}`);
  const commit = await j<any>('POST', `/statements/pending/${preview.pendingId}/commit`);
  console.log(`  committed: +${commit.imported} transactions`);
}

const overview = await j<any>('GET', '/overview?period=financial_year');
console.log(`\nOVERVIEW (${overview.overview.period.label}):`);
console.log(`  cards=${overview.overview.cardCount} totalSpend=₹${overview.overview.totalSpend} eligibleSpend=₹${overview.overview.eligibleSpend}`);
console.log(`  estimatedEarned=₹${overview.overview.estimatedEarned} pendingCredit=₹${overview.overview.pendingCredit} attainable=₹${overview.overview.potentialAttainable} unlocked=${overview.overview.benefitsUnlocked}`);

for (const c of overview.cards) {
  console.log(`\nCARD ${c.card.cardName} — spend ₹${c.totalSpend}, eligible ₹${c.eligibleSpend}`);
  for (const p of c.progress) {
    console.log(`  - ${p.name}: ${p.status} | eligible ₹${p.eligibleSpend}/${p.threshold} | earned ${p.earnedValue} | remaining ₹${p.remainingToThreshold} | deadline ${p.deadline} | verified=${!p.requiresVerification}`);
  }
}

const recs = await j<any[]>('GET', '/recommendations?period=financial_year');
console.log(`\nRECOMMENDATIONS (${recs.length}):`);
for (const r of recs.slice(0, 6)) console.log(`  [${r.kind}] ${r.title} — ${r.reason}`);

const txns = await j<any>('GET', '/transactions?limit=5');
console.log(`\nTRANSACTIONS sample (${txns.count}):`);
for (const t of txns.transactions) console.log(`  ${t.txnDate} ${t.merchant} ₹${t.amount} ${t.direction} [${t.category}] eligibleFor=${JSON.stringify(t.eligibleFor)}`);
