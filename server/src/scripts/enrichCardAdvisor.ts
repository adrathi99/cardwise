/**
 * Enrich imported CardAdvisor cards and benefits with the keyed stated view.
 *
 * Usage:
 *   npm --workspace server run enrich:cardadvisor [-- --limit=5] [-- --offset=60] [-- --sleep=1100]
 *
 * Requires CARDWISE_CARDADVISOR_KEY in server/.env. One API call per card
 * (default 1.1s spacing to stay under the 60/min keyed limit).
 */
import { config } from '../config.ts';
import { enrichFromStatedView } from '../sources/import.ts';

if (!config.cardadvisor.apiKey) {
  console.error('CARDWISE_CARDADVISOR_KEY is not set in server/.env');
  process.exit(1);
}

function numberArg(name: string): number | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const n = Number(hit.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const started = Date.now();
const result = await enrichFromStatedView({
  limit: numberArg('limit'),
  offset: numberArg('offset'),
  sleepMs: numberArg('sleep'),
  onProgress: (done, total, slug) => {
    if ((done + (numberArg('offset') ?? 0)) % 20 === 0 || done === total) console.log(`[${done}/${total}] ${slug}`);
  },
});

console.log(
  JSON.stringify(
    {
      ...result,
      errors: result.errors.slice(0, 10),
      seconds: Math.round((Date.now() - started) / 1000),
    },
    null,
    2,
  ),
);
