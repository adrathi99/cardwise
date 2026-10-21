import { type ReactNode } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { CardAnalytics, Portfolio, Recommendation, UserCard } from '../lib/types.ts';
import { Panel, SectionTitle, Pill, Progress, Spinner, ErrorBox, EmptyState, Button, InfoTip } from '../components/ui.tsx';
import { inr, inrCompact, shortDate, dayMonth, titleCase, daysUntil } from '../lib/format.ts';
import { benefitShortTitle, benefitTitle } from '../lib/benefitCopy.ts';

const KIND: Record<string, { tone: 'green' | 'blue' | 'amber' | 'violet' | 'neutral'; label: string }> = {
  category_switch: { tone: 'blue', label: 'Route spend' },
  milestone: { tone: 'green', label: 'Milestone' },
  activation: { tone: 'violet', label: 'Activate' },
  not_worthwhile: { tone: 'amber', label: 'Caution' },
};

const TIER_TONE: Record<string, 'neutral' | 'blue' | 'violet' | 'amber' | 'green'> = {
  entry: 'neutral',
  mid: 'blue',
  premium: 'violet',
  super_premium: 'violet',
  ultra_premium: 'amber',
  luxury: 'amber',
};

interface Theme {
  from: string;
  via: string;
  to: string;
}

const THEMES: { match: RegExp; theme: Theme }[] = [
  { match: /icici/i, theme: { from: '#2a1250', via: '#5b21b6', to: '#0b1020' } },
  { match: /hdfc/i, theme: { from: '#0a2a45', via: '#0e4a75', to: '#071521' } },
  { match: /sbi/i, theme: { from: '#08302b', via: '#0f766e', to: '#04150f' } },
  { match: /axis/i, theme: { from: '#400d1e', via: '#9f1239', to: '#160408' } },
  { match: /kotak/i, theme: { from: '#431407', via: '#c2410c', to: '#180701' } },
  { match: /amex|american express/i, theme: { from: '#0a2f4a', via: '#0369a1', to: '#06121f' } },
  { match: /idfc|indusind|yes|rbl|federal/i, theme: { from: '#1e1b4b', via: '#4338ca', to: '#0a0c24' } },
];

const DEFAULT_THEME: Theme = { from: '#0b1c17', via: '#065f46', to: '#07120f' };

function themeFor(card: UserCard): Theme {
  for (const t of THEMES) if (t.match.test(`${card.issuer} ${card.cardName}`)) return t.theme;
  return DEFAULT_THEME;
}

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
      <div className="space-y-5">
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
  const orderedCards = [...cards].sort((a, b) => b.totalSpend - a.totalSpend);

  return (
    <div className="space-y-8">
      <PageHead period={overview.period.label} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="Spend this period" value={inrCompact(overview.totalSpend)} hint={`${inrCompact(overview.eligibleSpend)} benefit-eligible`} glyph="◎" />
        <Kpi label="Value earned" value={inrCompact(overview.estimatedEarned)} hint="Cashback + points (when valued)" glyph="✦" accent />
        <Kpi label="Pending credit" value={inrCompact(overview.pendingCredit)} hint="Earned but not yet posted" glyph="◷" />
        <Kpi label="Still attainable" value={inrCompact(overview.potentialAttainable)} hint="If remaining milestones land" glyph="↗" />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-slate-100">Your cards</h2>
            <p className="mt-0.5 text-[12.5px] text-slate-400">
              Every card you added, with its own spend, rewards and benefit progress.
            </p>
          </div>
          <span className="rounded-full border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-500">
            {overview.cardCount} tracked · {overview.period.label}
          </span>
        </div>
        <div className="space-y-5">
          {orderedCards.map((c) => (
            <CardSection key={c.card.id} c={c} />
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel>
            <SectionTitle sub="Deterministic suggestions from your own spend — no invented numbers.">What to do next</SectionTitle>
            {recs.loading && !recs.data ? (
              <Spinner label="Analysing…" />
            ) : (recs.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-8 text-center text-[13px] text-slate-400">
                No actions needed right now. Keep using the best card for each category.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(recs.data ?? []).map((r) => {
                  const meta = KIND[r.kind] ?? { tone: 'neutral' as const, label: r.kind };
                  return (
                    <div
                      key={r.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 transition-colors hover:border-slate-700 hover:bg-slate-900/70"
                    >
                      <span className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-emerald-400/70 to-teal-500/0" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            <span className="text-[13.5px] font-semibold text-slate-100">{r.title}</span>
                          </div>
                          <div className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{r.detail}</div>
                          <div className="mt-1 text-[11.5px] text-slate-500">{r.reason}</div>
                          {r.assumptions.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                              {r.assumptions.map((a, i) => (
                                <li key={i}>• {a}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        {r.estimatedValue != null && r.estimatedValue > 0 && (
                          <div className="shrink-0 text-right">
                            <div className="tabnum text-[15px] font-semibold text-emerald-400">{inrCompact(r.estimatedValue)}</div>
                            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">est. value</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  const urgent = days <= 14;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800/70 bg-slate-900/40 px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-medium text-slate-200">{d.name}</div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {d.cardNickname} · {shortDate(d.date)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`tabnum text-[12px] font-semibold ${urgent ? 'text-amber-300' : 'text-slate-300'}`}>
                          {days < 0 ? 'past' : `${days}d`}
                        </div>
                        <div className="tabnum text-[11px] text-slate-500">{inrCompact(d.remaining)}</div>
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
              <div className="space-y-3">
                {topCategories.map(([cat, amt]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-[12px] text-slate-400">
                      <span>{titleCase(cat)}</span>
                      <span className="tabnum text-slate-300">{inrCompact(amt)}</span>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={(amt / maxCat) * 100} height={5} tone="sky" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionTitle>Data freshness</SectionTitle>
            <div className="space-y-2 text-[12.5px] text-slate-400">
              <Row label="Cards tracked" value={<span className="font-medium tabnum text-slate-200">{overview.cardCount}</span>} />
              <Row label="Benefits unlocked" value={<span className="font-medium tabnum text-slate-200">{overview.benefitsUnlocked}</span>} />
              <Row label="Period" value={<span className="font-medium text-slate-200">{overview.period.label}</span>} />
            </div>
            <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-amber-200/90">
              Catalogue benefit terms are unverified in this build. Always confirm on the issuer’s official page before acting.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      {value}
    </div>
  );
}

function PageHead({ period }: { period: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-50">Overview</h1>
        <p className="mt-1 text-[13px] text-slate-400">Your benefits, computed from statements you uploaded.</p>
      </div>
      <div className="flex items-center gap-2.5 rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-[11.5px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Local-first
        </span>
        <span className="h-3 w-px bg-slate-800" />
        <span className="font-medium text-slate-300">{period}</span>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  glyph,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  glyph: string;
  accent?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] backdrop-blur-sm transition-colors hover:border-slate-700/80">
      <div
        className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl ${
          accent ? 'bg-emerald-500/15' : 'bg-sky-500/10'
        }`}
      />
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-slate-400">{label}</div>
        <span className={`text-[13px] ${accent ? 'text-emerald-400' : 'text-slate-600'}`}>{glyph}</span>
      </div>
      <div className={`mt-2 tabnum text-[24px] font-semibold leading-tight ${accent ? 'text-emerald-400' : 'text-slate-50'}`}>{value}</div>
      <div className="mt-1 text-[11.5px] text-slate-500">{hint}</div>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/35 px-3 py-2.5">
      <div className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 tabnum text-[16px] font-semibold ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function CardSection({ c }: { c: CardAnalytics }) {
  const tracked = c.progress.filter((p) => p.threshold > 0).sort((a, b) => b.progressPct - a.progressPct);
  const perks = c.progress.filter((p) => p.threshold === 0);
  const topCats = Object.entries(c.categorySpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const tierTone = TIER_TONE[String(c.card.tier)] ?? 'neutral';

  return (
    <article className="relative animate-rise overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_36px_70px_-48px_rgba(0,0,0,0.95)] backdrop-blur-sm sm:p-6">
      <div className="pointer-events-none absolute -top-28 right-0 h-56 w-72 rounded-full bg-emerald-500/[0.06] blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[318px_minmax(0,1fr)] lg:gap-7">
        <div className="space-y-3">
          <CreditCardVisual card={c.card} />
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={tierTone}>{titleCase(String(c.card.tier))} tier</Pill>
            {c.card.network && <Pill tone="neutral">{c.card.network}</Pill>}
            {c.card.last4 && <Pill tone="neutral">••{c.card.last4}</Pill>}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[16.5px] font-semibold tracking-tight text-slate-50">{c.card.nickname || c.card.cardName}</h3>
              <div className="mt-0.5 text-[12px] text-slate-400">
                {c.card.issuer}
                {c.card.cardName && c.card.cardName !== (c.card.nickname || c.card.cardName) ? ` · ${c.card.cardName}` : ''}
              </div>
            </div>
            {c.nextDeadline && (
              <div className="shrink-0 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-right">
                <div className="text-[10px] uppercase tracking-[0.12em] text-amber-300/80">Next deadline</div>
                <div className="mt-0.5 text-[12px] font-medium text-amber-200">
                  {dayMonth(c.nextDeadline.date)} · {inrCompact(c.nextDeadline.remaining)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Metric label="Spend" value={inrCompact(c.totalSpend)} />
            <Metric label="Eligible" value={inrCompact(c.eligibleSpend)} />
            <Metric label="Earned" value={inrCompact(c.earnedValue)} accent />
            <Metric label="Pending" value={inrCompact(c.pendingValue)} />
          </div>

          <div className="mt-5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Benefit progress</span>
              <span className="text-[11px] text-slate-600">{tracked.length} spend-tracked</span>
            </div>
            {tracked.length === 0 ? (
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 px-3.5 py-3 text-[12px] text-slate-500">
                No spend-tracked benefits for this card — perks below apply automatically.
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {tracked.slice(0, 4).map((p) => {
                  const tone = p.status === 'earned' ? 'emerald' : p.status === 'not_started' ? 'slate' : 'emerald';
                  return (
                    <div key={p.benefitId} className="rounded-xl border border-slate-800/70 bg-slate-900/35 px-3.5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12.5px] font-medium text-slate-200" title={p.description ?? benefitTitle(p)}>
                          {benefitTitle(p)}
                        </span>
                        <span className="tabnum shrink-0 text-[11px] text-slate-400">
                          {inrCompact(p.eligibleSpend)} / {inrCompact(p.threshold)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <Progress value={p.progressPct} height={5} tone={tone} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10.5px]">
                        <span className={p.status === 'earned' ? 'text-emerald-400' : p.status === 'not_started' ? 'text-slate-500' : 'text-slate-400'}>
                          {p.status === 'earned' ? 'Unlocked' : p.status === 'not_started' ? 'Not started' : `${Math.round(p.progressPct)}%`}
                        </span>
                        <span className="text-slate-600">by {dayMonth(p.deadline)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(topCats.length > 0 || perks.length > 0) && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {topCats.map(([cat, amt]) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
                  {titleCase(cat)}
                  <span className="tabnum text-slate-200">{inrCompact(amt)}</span>
                </span>
              ))}
              {perks.slice(0, 3).map((p) => (
                <span
                  key={p.benefitId}
                  title={p.description ?? benefitShortTitle(p)}
                  className="rounded-full border border-slate-800/60 bg-slate-900/30 px-2.5 py-1 text-[11px] text-slate-500"
                >
                  {benefitShortTitle(p)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function CreditCardVisual({ card }: { card: UserCard }) {
  const t = themeFor(card);
  return (
    <div
      className="relative aspect-[1.586] w-full overflow-hidden rounded-2xl p-4 shadow-[0_26px_60px_-30px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-white/10"
      style={{ background: `linear-gradient(135deg, ${t.from} 0%, ${t.via} 58%, ${t.to} 100%)` }}
    >
      <div className="pointer-events-none absolute -inset-y-12 -left-1/3 w-1/3 rotate-12 bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.14),transparent_55%)]" />
      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[9.5px] uppercase tracking-[0.22em] text-white/55">{card.issuer}</div>
            <div className="mt-1 truncate text-[12.5px] font-semibold text-white/90">{card.cardName}</div>
          </div>
          <div className="shrink-0 text-[10px] font-semibold tracking-[0.18em] text-white/70">{card.network ?? 'CARD'}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-6 w-8 overflow-hidden rounded-[5px] bg-gradient-to-br from-amber-200 to-amber-500 ring-1 ring-inset ring-amber-900/30">
            <div
              className="h-full w-full opacity-60"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(120,53,15,0.5) 0 1px, transparent 1px 7px)' }}
            />
          </div>
          <div className="tabnum text-[13px] tracking-[0.18em] text-white/85">•••• •••• •••• {card.last4 ?? '••••'}</div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] text-white/60">{card.nickname || card.cardName}</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-white/40">{titleCase(String(card.tier))} tier</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[8.5px] uppercase tracking-[0.18em] text-white/40">Annual fee</div>
            <div className="tabnum text-[11.5px] font-medium text-white/85">{card.annualFee ? inr(card.annualFee) : 'Nil'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
