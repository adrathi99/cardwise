import { useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import { Panel, Pill, Spinner, Button, SectionTitle, InfoTip } from '../components/ui.tsx';
import { shortDate } from '../lib/format.ts';

interface Source {
  id: number;
  name: string;
  kind: string;
  url: string;
  issuer_slug: string | null;
  status: string;
  last_checked_at: string | null;
  notes: string | null;
  lastChecked: string | null;
  lastStatus: string | null;
}

interface SourcesResponse {
  sources: Source[];
  cardadvisor: { url: string; openapi: string; developers: string; availability: string; note: string };
}

const STATUS_TONE: Record<string, 'green' | 'red' | 'amber' | 'neutral'> = {
  ok: 'green',
  error: 'red',
  unavailable: 'amber',
  blocked: 'red',
  known: 'neutral',
  unknown: 'neutral',
};

export function SourcesView({ version, onChanged }: { version: number; onChanged: () => void }) {
  const data = useAsync(() => api.get<SourcesResponse>('/sources/status'), [version]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function checkAll() {
    setBusy(true);
    setResult(null);
    try {
      const r = await api.post<{ results: { url: string; status: string; httpStatus?: number }[] }>('/sources/check');
      const ok = r.results.filter((x) => x.status === 'ok').length;
      setResult(`Checked ${r.results.length} sources · ${ok} reachable.`);
      onChanged();
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (data.loading && !data.data) return <Spinner />;

  const sources = data.data?.sources ?? [];
  const ca = data.data?.cardadvisor;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-100">Data Sources & Settings</h1>
          <p className="text-[13px] text-slate-400">Where benefit data comes from, its freshness, and privacy posture.</p>
        </div>
        <Button variant="secondary" onClick={checkAll} disabled={busy}>
          {busy ? 'Checking…' : 'Re-check sources'}
        </Button>
      </div>

      {result && <div className="rounded-lg bg-slate-800 px-3 py-2 text-[12.5px] text-slate-300">{result}</div>}

      <Panel>
        <SectionTitle sub="Every benefit in the catalogue points to an official issuer page. Status reflects the last reachability check.">
          Issuer sources
        </SectionTitle>
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-200">{s.name}</span>
                  <Pill tone="neutral">{s.kind}</Pill>
                </div>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-[11.5px] text-slate-400 hover:text-emerald-300 hover:underline">
                  {s.url}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-[11px] text-slate-400">
                  {s.lastChecked ? `checked ${shortDate(s.lastChecked.slice(0, 10))}` : 'not checked yet'}
                </div>
                <Pill tone={STATUS_TONE[s.lastStatus ?? s.status] ?? 'neutral'}>{s.lastStatus ?? s.status}</Pill>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5">
            CardAdvisor API
            <InfoTip text="A public card-data API that was planned as a data source. It is not reachable from this environment." />
          </span>
        </SectionTitle>
        {ca && (
          <div className="space-y-2 text-[12.5px] text-slate-300">
            <div className="flex items-center gap-2">
              <span>Availability</span>
              <Pill tone="red">{ca.availability}</Pill>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-300">{ca.note}</div>
            <div className="grid gap-1 text-[11.5px] text-slate-400">
              <span>Data: {ca.url}</span>
              <span>OpenAPI: {ca.openapi}</span>
              <span>Developers: {ca.developers}</span>
            </div>
          </div>
        )}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel>
          <SectionTitle>Privacy</SectionTitle>
          <ul className="space-y-1.5 text-[12.5px] text-slate-300">
            <li>• All statement parsing runs locally on this machine.</li>
            <li>• No bank credentials are ever requested or stored.</li>
            <li>• Data lives in a local SQLite file, not a remote server.</li>
            <li>• AI assistance is disabled by default; the benefits engine is deterministic.</li>
          </ul>
        </Panel>
        <Panel>
          <SectionTitle>Accuracy</SectionTitle>
          <ul className="space-y-1.5 text-[12.5px] text-slate-300">
            <li>• Tracked spend comes only from statements you upload.</li>
            <li>• Reward points are shown as points; a rupee value is shown only when a trusted conversion exists.</li>
            <li>• Merchant-specific offers (e.g. “select merchants”) are approximated by category and flagged as such.</li>
            <li>• Catalogue terms are marked unverified until confirmed against the issuer’s official page.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
