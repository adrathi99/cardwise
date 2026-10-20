import { useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { BenefitProgress, UserCard } from '../lib/types.ts';
import { Panel, Pill, Progress, Spinner, ErrorBox, EmptyState, InfoTip, Button, confidenceTone } from '../components/ui.tsx';
import { inr, inrCompact, pct, shortDate, titleCase } from '../lib/format.ts';

interface ProgressResponse {
  period: { label: string; start: string; end: string };
  cards: { card: UserCard; eligibleSpend: number; totalSpend: number; earnedValue: number; progress: BenefitProgress[] }[];
}

const STATUS_TONE: Record<string, 'green' | 'blue' | 'amber' | 'neutral'> = {
  earned: 'green',
  earning: 'blue',
  in_progress: 'blue',
  not_started: 'neutral',
  expired: 'neutral',
  inactive: 'neutral',
};

export function BenefitsView({ version, period, onChange }: { version: number; period: string; onChange: () => void }) {
  const data = useAsync(() => api.get<ProgressResponse>(`/benefits/progress?period=${period}`), [version, period]);
  const [open, setOpen] = useState<number | null>(null);

  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <ErrorBox message={data.error} onRetry={data.reload} />;
  const cards = data.data?.cards ?? [];

  const all = cards.flatMap((c) => c.progress);
  const earned = all.filter((p) => p.status === 'earned').length;
  const inProgress = all.filter((p) => p.status === 'in_progress' || p.status === 'earning').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Benefits Tracker</h1>
          <p className="text-[13px] text-slate-500">
            Progress against milestones and caps · <span className="font-medium text-slate-600">{data.data?.period.label}</span>
          </p>
        </div>
        <div className="flex gap-2 text-[12px]">
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">{earned} earned</span>
          <span className="rounded-lg bg-sky-50 px-2.5 py-1 font-medium text-sky-700">{inProgress} in progress</span>
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState title="No cards to track" body="Add a card and upload a statement to see benefit progress." />
      ) : (
        <div className="space-y-4">
          {cards.map((c) => (
            <Panel key={c.card.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold text-slate-900">{c.card.nickname || c.card.cardName}</div>
                  <div className="text-[12px] text-slate-500">
                    {c.card.issuer} · spend {inrCompact(c.totalSpend)} · earned <span className="text-emerald-600">{inrCompact(c.earnedValue)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {c.progress.map((p) => {
                  const isOpen = open === p.benefitId;
                  return (
                    <div key={p.benefitId} className="rounded-xl border border-ink-200">
                      <button
                        className="flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left"
                        onClick={() => setOpen(isOpen ? null : p.benefitId)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-medium text-slate-900">{p.name}</span>
                            <Pill tone={STATUS_TONE[p.status] ?? 'neutral'}>{titleCase(p.status)}</Pill>
                            <Pill tone="neutral">{titleCase(p.period.type)}</Pill>
                            {p.requiresActivation && <Pill tone="violet">Needs activation</Pill>}
                            {p.requiresVerification && <Pill tone="amber">Unverified terms</Pill>}
                          </div>
                          <div className="mt-1.5 flex items-center gap-3">
                            <div className="w-full max-w-sm">
                              <Progress value={p.progressPct} height={6} tone={p.status === 'earned' ? 'emerald' : 'emerald'} />
                            </div>
                            <span className="tabnum shrink-0 text-[11.5px] text-slate-500">
                              {p.threshold > 0 ? `${inr(p.eligibleSpend, { decimals: 0 })} / ${inr(p.threshold, { decimals: 0 })}` : inr(p.eligibleSpend, { decimals: 0 })}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          {p.earnedValue != null ? (
                            <>
                              <div className="tabnum text-[14px] font-semibold text-emerald-600">{inr(p.earnedValue)}</div>
                              <div className="text-[10.5px] uppercase tracking-wide text-slate-400">earned</div>
                            </>
                          ) : p.earnedPoints != null ? (
                            <>
                              <div className="tabnum text-[14px] font-semibold text-slate-700">{p.earnedPoints.toLocaleString('en-IN')} pts</div>
                              <div className="text-[10.5px] uppercase tracking-wide text-slate-400">value unknown</div>
                            </>
                          ) : (
                            <div className="text-[12px] text-slate-400">—</div>
                          )}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="border-t border-ink-100 px-3.5 py-3">
                          <div className="grid gap-3 text-[12.5px] sm:grid-cols-2">
                            <Detail label="This period">
                              {p.period.label} · {shortDate(p.period.start)} → {shortDate(p.period.end)}
                              {p.period.basedOnAnniversary && <span className="ml-1 text-slate-400">(your card anniversary)</span>}
                            </Detail>
                            <Detail label="Deadline">{shortDate(p.deadline)}</Detail>
                            <Detail label="Eligible spend">{inr(p.eligibleSpend)}</Detail>
                            {p.threshold > 0 && <Detail label="Remaining to unlock">{inr(p.remainingToThreshold)}</Detail>}
                            {p.cap != null && (
                              <Detail label="Cap">
                                {inr(p.cap)} {p.capRemaining != null && <span className="text-slate-400">· {inr(p.capRemaining)} left</span>}
                              </Detail>
                            )}
                            {p.ratePercent != null && <Detail label="Effective rate">{pct(p.ratePercent, 2)} of eligible spend</Detail>}
                            {p.attainableValue != null && p.attainableValue > 0 && <Detail label="Still attainable">{inr(p.attainableValue)}</Detail>}
                            <Detail label="Eligible transactions">{p.eligibleTxnCount}</Detail>
                          </div>

                          {p.explanation.length > 0 && (
                            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">How this is calculated</div>
                              <ul className="space-y-0.5 text-[12px] text-slate-600">
                                {p.explanation.map((e, i) => (
                                  <li key={i}>• {e}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
                            <Pill tone={confidenceTone(p.officialSource.confidence)}>Source: {p.officialSource.confidence}</Pill>
                            {p.officialSource.label && <span className="text-slate-400">{p.officialSource.label}</span>}
                            {p.officialSource.url && (
                              <a href={p.officialSource.url} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:underline">
                                Open official source ↗
                              </a>
                            )}
                          </div>

                          {p.redemption && <div className="mt-2 text-[12px] text-slate-500"><span className="font-medium text-slate-600">How to redeem:</span> {p.redemption}</div>}
                          {p.expiryRules && <div className="mt-1 text-[12px] text-slate-500"><span className="font-medium text-slate-600">Expiry:</span> {p.expiryRules}</div>}

                          {p.requiresActivation && (
                            <div className="mt-3 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2">
                              <span className="text-[12px] text-violet-700">This benefit must be activated on the issuer’s app/site.</span>
                              <Button size="sm" variant="secondary" onClick={onChange}>
                                Mark activated
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {c.progress.length === 0 && <div className="text-[12.5px] text-slate-400">No benefits configured for this card.</div>}
              </div>
            </Panel>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
        <InfoTip text="CARDWISE computes progress only from the statements you imported. Milestones based on total annual spend are estimates until your full year is uploaded." />
        <span>
          Spend-based milestones reflect only the statements you have uploaded. Percentages and points values shown as “unknown” are deliberately not
          converted to rupees to avoid inventing value.
        </span>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-0.5 text-slate-700">{children}</div>
    </div>
  );
}
