import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { Portfolio, Recommendation } from '../lib/types.ts';
import { Panel, Stat, SectionTitle, Pill, Progress, Spinner, ErrorBox, EmptyState, Button, InfoTip } from '../components/ui.tsx';
import { inr, inrCompact, shortDate, dayMonth, titleCase, daysUntil } from '../lib/format.ts';

const KIND: Record<string, { tone: 'green' | 'blue' | 'amber' | 'violet' | 'neutral'; label: string }> = {
  category_switch: { tone: 'blue', label: 'Route spend' },
  milestone: { tone: 'green', label: 'Milestone' },
  activation: { tone: 'violet', label: 'Activate' },
  not_worthwhile: { tone: 'amber', label: 'Caution' },
};

export function OverviewView({
  version,
  period,
  onAddCard,
  onUpload,
}: {
  version: number;
  period: string;
  onAddCard: () => void;
  onUpload: () => void;
}) {
  const portfolio = useAsync(() => api.get<Portfolio>(`/overview?period=${period}`), [version, period]);
  const recs = useAsync(() => api.get<Recommendation[]>(`/recommendations?period=${period}`), [version, period]);

  if (portfolio.loading && !portfolio.data) return <Spinner />;
  if (portfolio.error) return <ErrorBox message={portfolio.error} onRetry={portfolio.reload} />;
  if (!portfolio.data) return null;

  const { overview, cards } = portfolio.data;

  if (overview.cardCount === 0) {
    return (
      <div className="space-y-4">
        <PageHead period={overview.period.label} />
        <EmptyState
          title="Add your first card to begin"
          body="CARDWISE works from your own statement data — no bank login, nothing leaves your machine. Add a card, then upload a PDF statement."
          action={
            <div className="flex gap-2">
              <Button onClick={onAddCard}>Add a card</Button>
              <Button variant="secondary" onClick={onUpload}>
                Upload statement
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const categoryTotals = new Map<string, number>();
  for (const c of cards) for (const [cat, amt] of Object.entries(c.categorySpend)) categoryTotals.set(cat, (categoryTotals.get(cat) ?? 0) + amt);
  const topCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = topCategories[0]?.[1] ?? 1;

  return (
    <div className="space-y-5">
      <PageHead period={overview.period.label} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Panel>
          <Stat
            label="Spend this period"
            value={inrCompact(overview.totalSpend)}
            hint={`${inrCompact(overview.eligibleSpend)} was benefit-eligible`}
          />
        </Panel>
        <Panel>
          <Stat
            label="Value earned"
            value={inrCompact(overview.estimatedEarned)}
            tone="accent"
            hint="Cashback + points (points valued only if known)"
          />
        </Panel>
        <Panel>
          <Stat label="Pending credit" value={inrCompact(overview.pendingCredit)} hint="Earned but not yet posted" />
        </Panel>
        <Panel>
          <Stat
            label="Still attainable"
            value={inrCompact(overview.potentialAttainable)}
            hint="If you hit remaining milestones"
          />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel>
            <SectionTitle sub="Deterministic suggestions from your own spend — no invented numbers.">
              What to do next
            </SectionTitle>
            {recs.loading && !recs.data ? (
              <Spinner label="Analysing…" />
            ) : (recs.data ?? []).length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
                No actions needed right now. Keep using the best card for each category.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(recs.data ?? []).map((r) => {
                  const meta = KIND[r.kind] ?? { tone: 'neutral' as const, label: r.kind };
                  return (
                    <div key={r.id} className="rounded-xl border border-ink-200 p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            <span className="text-[13.5px] font-semibold text-slate-900">{r.title}</span>
                          </div>
                          <div className="mt-1 text-[13px] text-slate-600">{r.detail}</div>
                          <div className="mt-1 text-[12px] text-slate-400">{r.reason}</div>
                          {r.assumptions.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-slate-400">
                              {r.assumptions.map((a, i) => (
                                <li key={i}>• {a}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {r.estimatedValue != null && r.estimatedValue > 0 && (
                          <div className="shrink-0 text-right">
                            <div className="tabnum text-[15px] font-semibold text-emerald-600">{inrCompact(r.estimatedValue)}</div>
                            <div className="text-[10.5px] uppercase tracking-wide text-slate-400">est. value</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle>Your cards this period</SectionTitle>
            <div className="space-y-3">
              {cards.map((c) => (
                <div key={c.card.id} className="rounded-xl border border-ink-200 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-slate-900">
                        {c.card.nickname || c.card.cardName}
                        {c.card.last4 && <span className="ml-1.5 font-normal text-slate-400">••{c.card.last4}</span>}
                      </div>
                      <div className="text-[12px] text-slate-500">
                        {c.card.issuer} · spent {inrCompact(c.totalSpend)} · earned{' '}
                        <span className="text-emerald-600">{inrCompact(c.earnedValue)}</span>
                      </div>
                    </div>
                    {c.nextDeadline && (
                      <div className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-right">
                        <div className="text-[11px] text-slate-500">Next deadline</div>
                        <div className="text-[12px] font-medium text-slate-700">
                          {dayMonth(c.nextDeadline.date)} · {inrCompact(c.nextDeadline.remaining)} to go
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-1.5">
                    {c.progress
                      .filter((p) => p.threshold > 0)
                      .slice(0, 3)
                      .map((p) => (
                        <div key={p.benefitId}>
                          <div className="flex items-center justify-between text-[11.5px] text-slate-500">
                            <span className="truncate pr-2">{p.name}</span>
                            <span className="tabnum shrink-0">{inr(p.eligibleSpend, { decimals: 0 })} / {inr(p.threshold, { decimals: 0 })}</span>
                          </div>
                          <div className="mt-1">
                            <Progress value={p.progressPct} height={6} tone={p.status === 'earned' ? 'emerald' : 'emerald'} />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                Upcoming deadlines
                <InfoTip text="Milestones that need spend before they reset or expire. Based on your stated or observed spend." />
              </span>
            </SectionTitle>
            {overview.upcomingDeadlines.length === 0 ? (
              <div className="text-[12.5px] text-slate-500">Nothing due in the next 90 days.</div>
            ) : (
              <div className="space-y-2">
                {overview.upcomingDeadlines.slice(0, 6).map((d, i) => {
                  const days = daysUntil(d.date);
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-medium text-slate-800">{d.name}</div>
                        <div className="text-[11.5px] text-slate-500">
                          {d.cardNickname} · {shortDate(d.date)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`text-[12px] font-semibold ${days <= 14 ? 'text-amber-600' : 'text-slate-600'}`}>
                          {days < 0 ? 'past' : `${days}d`}
                        </div>
                        <div className="tabnum text-[11px] text-slate-400">{inrCompact(d.remaining)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                Where your money went
                <InfoTip text="Spend by category from your imported statements, after refunds." />
              </span>
            </SectionTitle>
            {topCategories.length === 0 ? (
              <div className="text-[12.5px] text-slate-500">No spend recorded yet.</div>
            ) : (
              <div className="space-y-2.5">
                {topCategories.map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-[12px] text-slate-600">
                      <span>{titleCase(cat)}</span>
                      <span className="tabnum">{inrCompact(amt)}</span>
                    </div>
                    <div className="mt-1">
                      <Progress value={(amt / maxCat) * 100} height={6} tone="sky" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle>Data freshness</SectionTitle>
            <div className="space-y-1.5 text-[12.5px] text-slate-600">
              <div className="flex justify-between">
                <span>Cards tracked</span>
                <span className="font-medium tabnum">{overview.cardCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Benefits unlocked</span>
                <span className="font-medium tabnum">{overview.benefitsUnlocked}</span>
              </div>
              <div className="flex justify-between">
                <span>Period</span>
                <span className="font-medium">{overview.period.label}</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-700">
              Catalogue benefit terms are unverified in this build. Always confirm on the issuer’s official page before acting.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function PageHead({ period }: { period: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-slate-900">Overview</h1>
        <p className="text-[13px] text-slate-500">
          Your benefits, computed from statements you uploaded · <span className="font-medium text-slate-600">{period}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 text-[11.5px] text-slate-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Local-first · nothing leaves this device
      </div>
    </div>
  );
}
