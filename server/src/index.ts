import express from 'express';
import cors from 'cors';
import { config } from './config.ts';
import { migrate } from './db.ts';
import { ensureDefaultProfile, seedCatalog, seedMerchantRules } from './seed/index.ts';
import { api } from './routes/api.ts';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: config.allowedOrigins.length ? config.allowedOrigins : true,
    credentials: false,
  }),
);

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'cardwise', version: '0.1.0' }));
app.use('/api', api);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  // Deliberately do not log transaction descriptions or file contents.
  console.error('[cardwise] request error:', message);
  res.status(400).json({ error: message });
});

migrate();
ensureDefaultProfile();
const seeded = seedCatalog();
seedMerchantRules();

app.listen(config.port, () => {
  console.log(`CARDWISE API listening on http://localhost:${config.port}`);
  console.log(`Data directory: ${config.dataDir}`);
  if (seeded.cards || seeded.benefits) console.log(`Seeded catalogue: +${seeded.cards} cards, +${seeded.benefits} benefits`);
  console.log('Auth mode:', config.authMode, '| AI categorisation:', config.enableAi ? 'enabled' : 'disabled');
});
