import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

const dataDir = path.resolve(serverRoot, process.env.CARDWISE_DATA_DIR ?? './data');
const filesDir = path.join(dataDir, 'statements');

for (const dir of [dataDir, filesDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export const config = {
  dataDir,
  filesDir,
  dbPath: path.join(dataDir, 'cardwise.sqlite'),
  port: Number(process.env.PORT ?? 8787),
  allowedOrigins: (process.env.CARDWISE_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  maxUploadBytes: Number(process.env.CARDWISE_MAX_UPLOAD_MB ?? 15) * 1024 * 1024,
  enableAi: process.env.CARDWISE_ENABLE_AI === 'true',
  authMode: process.env.CARDWISE_AUTH_MODE ?? 'local',
  cardadvisor: {
    datasetUrl: process.env.CARDWISE_CARDADVISOR_DATASET_URL ?? 'https://cardadvisor.in/data/cards.json',
    apiBase: process.env.CARDWISE_CARDADVISOR_API_BASE ?? 'https://cardadvisor.in/api/public/v1',
    apiKey: process.env.CARDWISE_CARDADVISOR_KEY ?? null,
  },
} as const;
