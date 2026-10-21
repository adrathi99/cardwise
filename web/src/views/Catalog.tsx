import { useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { BenefitRow, CatalogCard } from '../lib/types.ts';
import { Panel, Pill, ConfidencePill, VerificationPill, Spinner, ErrorBox, EmptyState, Modal, Button } from '../components/ui.tsx';
import { inr, titleCase } from '../lib/format.ts';

export function CatalogView({ version, onAdd }: { version: number; onAdd: (card: CatalogCard) => void }) {
  const catalog = useAsync(() => api.get<CatalogCard[]>('/cards'), [version]);
  const issuers = useAsync(() => api.get<{ id: number; name: string; slug: string }[]>('/issuers'), [version]);
  const [search, setSearch] = useState('');
  const [issuer, setIssuer] = useState('');
  const [tier, setTier] = useState('');
  const [detail, setDetail] = useState<CatalogCard | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog.data ?? []).filter(
      (c) =>
        (!q || `${c.name} ${c.issuer} ${c.variant ?? ''}`.toLowerCase().includes(q)) &&
        (!issuer || c.issuerSlug === issuer) &&
        (!tier || c.tier === tier),
    );
  }, [catalog.data, search, issuer, tier]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-slate-100">Card Catalogue</h1>
        <p className="text-[13px] text-slate-400">
          Reference data for benefits and eligibility. Marked <span className="font-medium">unverified</span> where terms have not been confirmed
          against an official source.
        </p>
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap gap-2 p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards…"
            className="min-w-[200px] flex-1 rounded-lg border border-slate-800 px-3 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          />
          <select
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          >
            <option value="">All issuers</option>
            {(issuers.data ?? []).map((i) => (
              <option key={i.slug} value={i.slug}>
                {i.name}
              </option>
            ))}
          </select>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          >
            <option value="">All tiers</option>
            {['entry', 'mid', 'premium', 'super_premium', 'secured'].map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {catalog.loading && !catalog.data ? (
        <Spinner />
      ) : catalog.error ? (
        <ErrorBox message={catalog.error} onRetry={catalog.reload} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No cards match" body="Try a different search or filter." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Panel key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-slate-100">{c.name}</div>
                  <div className="text-[12px] text-slate-400">
                    {c.issuer}
                    {c.variant ? ` · ${c.variant}` : ''}
                  </div>
                </div>
                <Pill tone="neutral">{titleCase(c.tier)}</Pill>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ConfidencePill confidence={c.dataConfidence} />
                <VerificationPill status={c.verificationStatus} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div>
                  <div className="text-slate-400">Annual fee</div>
                  <div className="tabnum font-medium text-slate-200">{c.annualFee ? inr(c.annualFee) : 'Nil / free'}</div>
                </div>
                <div>
                  <div className="text-slate-400">Benefits</div>
                  <div className="tabnum font-medium text-slate-200">{c.benefitCount}</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-slate-800 pt-3">
                <Button size="sm" variant="secondary" onClick={() => setDetail(c)}>
                  View benefits
                </Button>
                <Button size="sm" onClick={() => onAdd(c)}>
                  Add to my cards
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <CardDetailModal card={detail} onClose={() => setDetail(null)} onAdd={onAdd} />
    </div>
  );
}

function CardDetailModal({ card, onClose, onAdd }: { card: CatalogCard | null; onClose: () => void; onAdd: (c: CatalogCard) => void }) {
  const detail = useAsync(async () => {
    if (!card) return null;
    return api.get<{ card: CatalogCard; benefits: BenefitRow[] }>(`/cards/${card.id}`);
  }, [card?.id]);

  return (
    <Modal open={!!card} onClose={onClose} title={card?.name ?? ''} width="max-w-2xl">
      {detail.loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="neutral">{card?.issuer}</Pill>
            <Pill tone="neutral">{titleCase(card?.tier ?? '')}</Pill>
            {card && <ConfidencePill confidence={card.dataConfidence} />}
            {card && <VerificationPill status={card.verificationStatus} />}
            {card?.annualFee ? <Pill tone="amber">Fee {inr(card.annualFee)}/yr</Pill> : <Pill tone="green">No annual fee</Pill>}
          </div>

          {card?.notes && <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-[12.5px] text-slate-300">{card.notes}</div>}

          <div>
            <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-slate-400">Benefits ({detail.data?.benefits.length ?? 0})</div>
            <div className="space-y-2">
              {(detail.data?.benefits ?? []).map((b) => (
                <div key={b.id} className="rounded-xl border border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px] font-medium text-slate-100">{b.name}</div>
                    <Pill tone="neutral">{titleCase(b.category)}</Pill>
                  </div>
                  {b.description && <div className="mt-1 text-[12.5px] text-slate-300">{b.description}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px]">
                    <Pill tone="neutral">{titleCase(b.reward_type)}</Pill>
                    <Pill tone="neutral">{titleCase(b.period_type)}</Pill>
                    <Pill tone={b.confidence === 'high' ? 'green' : b.confidence === 'medium' ? 'blue' : 'amber'}>{b.confidence}</Pill>
                    {b.requires_activation === 1 && <Pill tone="violet">Activation</Pill>}
                    {b.threshold_amount ? <Pill tone="neutral">Min {inr(b.threshold_amount)}</Pill> : null}
                    {b.cap_amount ? <Pill tone="neutral">Cap {inr(b.cap_amount)}</Pill> : null}
                  </div>
                  <div className="mt-2 text-[11.5px]">
                    {b.source_url ? (
                      <a href={b.source_url} target="_blank" rel="noreferrer" className="font-medium text-emerald-400 hover:underline">
                        {b.source_label || 'Official source'} ↗
                      </a>
                    ) : (
                      <span className="text-slate-400">No official source linked</span>
                    )}
                  </div>
                </div>
              ))}
              {detail.data?.benefits.length === 0 && <div className="text-[12.5px] text-slate-400">No benefits recorded for this card.</div>}
            </div>
          </div>

          {detail.error && <ErrorBox message={detail.error} />}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {card && (
              <Button
                onClick={() => {
                  onAdd(card);
                  onClose();
                }}
              >
                Add to my cards
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
