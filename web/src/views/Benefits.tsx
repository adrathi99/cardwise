import { type ReactNode, useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { BenefitProgress, UserCard } from '../lib/types.ts';
import { Panel, Pill, Progress, Spinner, ErrorBox, EmptyState, InfoTip, confidenceTone } from '../components/ui.tsx';
import { inr, inrCompact, shortDate, titleCase } from '../lib/format.ts';
import {
  benefitKind,
  benefitTitle,
  earningRate,
  earningScope,
  earningValue,
  kindHint,
  kindLabel,
  periodLabel,
  statusText,
} from '../lib/benefitCopy.ts';

interface ProgressResponse {
  period: { label: string; start: string; end: string };
  cards: { card: UserCard; eligibleSpend: number; totalSpend: number; earnedValue: number; progress: BenefitProgress[] }[];
}

type CardGroup = ProgressResponse['cards'][number];

const STATUS_TONE: Record<string, 'green' | 'blue' | 'amber' | 'neutral'> = {
  earned: 'green',
  earning: 'blue',
  in_progress: 'blue',
  not_started: 'neutral',
  expired: 'neutral',
  inactive: 'neutral',
};

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  not_started: 1,
  earned: 2,
  uncertain: 3,
  expired: 4,
  inactive: 5,
};

export function BenefitsView({ version, period }: { version: number; period: string }) {
  const data = useAsync(() => api.get<ProgressResponse>(`/benefits/progress?period=${period}`), [version, period]);
  const [open, setOpen] = useState<number | null>(null);
  const [cardFilter, setCardFilter] = useState<number | 'all'>('all');

  if (data.loading && !data.data) return <Spinner />;
  if (data.error) return <ErrorBox message={data.error} onRetry={data.reload} />;
  const cards = data.data?.cards ?? [];

  const trackedAll = cards.flatMap((c) => trackedBenefits(c).map((p) => ({ p, card: c.card })));
  const unlocked = trackedAll.filter(({ p }) => p.status === 'earned').length;
  const inProgress = trackedAll.filter(({ p }) => p.status === 'in_progress' || p.status === 'not_started').length;
  const earnedValue = cards.reduce((sum, c) => sum + c.earnedValue, 0);
  const next = trackedAll
    .filter(({ p }) => p.status !== 'earned' && p.status !== 'expired' && p.status !== 'inactive')
    .sort((a, b) => a.p.deadline.localeCompare(b.p.deadline))[0];
  const visibleCards = cardFilter === 'all' ? cards : cards.filter((c) => c.card.id === cardFilter);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-50">Benefits</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-slate-400">
            What each benefit gives you, and how much eligible spend unlocks it. Progress is based only on the statements you have uploaded.
          </p>
        </div>
        <span className="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1.5 text-[11.5px] font-medium text-slate-300">
          {data.data?.period.label}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Summary label="Spend-based benefits" value={String(trackedAll.length)} hint="Across all cards" />
        <Summary label="Unlocked" value={String(unlocked)} hint="Qualified this period" accent />
        <Summary label="Still to unlock" value={String(inProgress)} hint="Need more spend" />
        <Summary label="Estimated value" value={inrCompact(earnedValue)} hint="Cashback + points, when valued" />
      </div>

      {next && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[12.5px]">
          <span className="text-amber-200">
            <span className="font-semibold">Next deadline:</span> {benefitTitle(next.p)}
            <span className="text-amber-300/80"> · {next.card.nickname || next.card.cardName}</span>
          </span>
          <span className="text-[11.5px] text-amber-300/80">
            {inr(next.p.remainingToThreshold, { decimals: 0 })} to go · {shortDate(next.p.deadline)}
          </span>
        </div>
      )}

      {cards.length === 0 ? (
        <EmptyState title="No cards to track" body="Add a card and upload a statement to see benefit progress." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={cardFilter === 'all'} onClick={() => setCardFilter('all')}>
              All cards <span className="opacity-60">{cards.length}</span>
            </FilterChip>
            {cards.map((c) => (
              <FilterChip key={c.card.id} active={cardFilter === c.card.id} onClick={() => setCardFilter(c.card.id)}>
                {c.card.nickname || c.card.cardName}
                <span className="opacity-60">{trackedBenefits(c).length}</span>
              </FilterChip>
            ))}
          </div>

          <div className="space-y-5">
            {visibleCards.map((c) => (
              <CardSection key={c.card.id} group={c} open={open} onToggle={(id) => setOpen(open === id ? null : id)} />
            ))}
          </div>
        </>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 text-[11.5px] leading-relaxed text-slate-400">
        <InfoTip text="CARDWISE computes progress only from the statements you imported. Annual milestones are estimates until your full year is uploaded, and point values are never invented when the redemption rate is unknown." />
        <span>
          Percentages and point totals reflect the statements you have uploaded so far. Benefits with an unknown point value show points instead of a rupee
          estimate.
        </span>
      </div>
    </div>
  );
}

function trackedBenefits(group: CardGroup): BenefitProgress[] {
  return group.progress
    .filter((p) => benefitKind(p) !== 'earning' && p.threshold > 0)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.progressPct - a.progressPct);
}

function CardSection({
  group,
  open,
  onToggle,
}: {
  group: CardGroup;
  open: number | null;
  onToggle: (id: number) => void;
}) {
  const { card } = group;
  const tracked = trackedBenefits(group);
  const alwaysOn = group.progress.filter((p) => benefitKind(p) !== 'earning' && p.threshold === 0);
  const earning = group.progress
    .filter((p) => benefitKind(p) === 'earning')
    .sort((a, b) => (a.category === 'base' ? -1 : b.category === 'base' ? 1 : a.category.localeCompare(b.category)));

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-slate-100">{card.nickname || card.cardName}</div>
          <div className="mt-0.5 text-[12px] text-slate-400">
            {card.issuer}
            {card.last4 ? ` · ••${card.last4}` : ''} · {titleCase(card.tier)} · spend {inrCompact(group.totalSpend)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">Earned this period</div>
          <div className="tabnum text-[16px] font-semibold text-emerald-400">{inrCompact(group.earnedValue)}</div>
        </div>
      </div>

      {tracked.length > 0 && (
        <div className="mt-4">
          <GroupHeading title="Spend-based benefits" hint={`${tracked.length} with a target`} />
          <div className="mt-2 grid gap-3 xl:grid-cols-2">
            {tracked.map((p) => (
              <BenefitCard key={p.benefitId} p={p} open={open === p.benefitId} onToggle={() => onToggle(p.benefitId)} />
            ))}
          </div>
        </div>
      )}

      {alwaysOn.length > 0 && (
        <div className="mt-5">
          <GroupHeading title="Included perks" hint="No spend target" />
          <div className="mt-2 grid gap-3 xl:grid-cols-2">
            {alwaysOn.map((p) => (
              <BenefitCard key={p.benefitId} p={p} open={open === p.benefitId} onToggle={() => onToggle(p.benefitId)} />
            ))}
          </div>
        </div>
      )}

      {earning.length > 0 && (
        <div className="mt-5">
          <GroupHeading title="Earning rates" hint="Applied automatically" />
          <EarningTable rows={earning} />
        </div>
      )}

      {group.progress.length === 0 && <div className="pt-3 text-[12.5px] text-slate-400">No benefits configured for this card yet.</div>}
    </Panel>
  );
}

function BenefitCard({ p, open, onToggle }: { p: BenefitProgress; open: boolean; onToggle: () => void }) {
  const kind = benefitKind(p);
  const tracked = p.threshold > 0;
  const earned = earningValue(p);
  const description = p.description && !/^Perk:\s.*Imported from CardAdvisor\.$/.test(p.description) ? p.description : null;

  return (
    <article className="flex flex-col rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 transition-colors hover:border-slate-700/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {kindLabel(kind)}
            </span>
            <Pill tone={STATUS_TONE[p.status] ?? 'neutral'}>{statusText(p.status)}</Pill>
            {p.requiresActivation && <Pill tone="violet">Needs activation</Pill>}
            {p.requiresVerification && <Pill tone="amber">Unverified terms</Pill>}
          </div>
          <h3 className="mt-1.5 text-[14.5px] font-semibold leading-snug text-slate-100">{benefitTitle(p)}</h3>
        </div>
        {kind !== 'earning' && p.earnedValue != null && p.earnedValue > 0 && (
          <div className="shrink-0 text-right">
            <div className="tabnum text-[15px] font-semibold text-emerald-400">{inr(p.earnedValue, { decimals: 0 })}</div>
            <div className="text-[9.5px] uppercase tracking-[0.1em] text-slate-500">earned</div>
          </div>
        )}
        {kind === 'earning' && earned && (
          <div className="shrink-0 text-right">
            <div className="tabnum text-[15px] font-semibold text-emerald-400">{earned}</div>
            <div className="text-[9.5px] uppercase tracking-[0.1em] text-slate-500">this period</div>
          </div>
        )}
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{description ?? kindHint(kind)}</p>

      {tracked ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
            <span className="text-slate-400">
              <span className="tabnum font-medium text-slate-200">{inr(p.eligibleSpend, { decimals: 0 })}</span> of{' '}
              <span className="tabnum text-slate-300">{inr(p.threshold, { decimals: 0 })}</span> eligible spend
            </span>
            <span className="tabnum font-medium text-slate-300">{Math.round(p.progressPct)}%</span>
          </div>
          <div className="mt-1.5">
            <Progress
              value={p.progressPct}
              height={6}
              tone={p.status === 'earned' ? 'emerald' : p.status === 'not_started' ? 'slate' : 'sky'}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
            <span>{p.period.label}</span>
            <span className="text-slate-600">·</span>
            <span>ends {shortDate(p.deadline)}</span>
            {p.status !== 'earned' && p.status !== 'expired' && p.status !== 'inactive' && (
              <>
                <span className="text-slate-600">·</span>
                <span className="font-medium text-amber-300">{inr(p.remainingToThreshold, { decimals: 0 })} more to unlock</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          {kind === 'earning' ? (
            <>
              <span className="font-medium text-slate-300">{earningRate(p)}</span>
              <span className="text-slate-600">·</span>
              <span>{earningScope(p)}</span>
              {p.cap != null && (
                <>
                  <span className="text-slate-600">·</span>
                  <span>cap {inr(p.cap, { decimals: 0 })}</span>
                </>
              )}
            </>
          ) : (
            <span>{kindHint(kind)}</span>
          )}
        </div>
      )}

      <button
        onClick={onToggle}
        className="mt-3 self-start text-[11.5px] font-medium text-slate-400 transition-colors hover:text-slate-200"
        aria-expanded={open}
      >
        {open ? 'Hide details' : 'Details, eligibility & source'}
      </button>

      {open && <BenefitDetails p={p} />}
    </article>
  );
}

function BenefitDetails({ p }: { p: BenefitProgress }) {
  const kind = benefitKind(p);
  return (
    <div className="mt-3 border-t border-slate-800 pt-3">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px] sm:grid-cols-3">
        <Fact label="Period">
          {p.period.label}
          <span className="mt-0.5 block text-[10.5px] font-normal text-slate-500">
            {periodLabel(p.period.type)} · {shortDate(p.period.start)} → {shortDate(p.period.end)}
          </span>
        </Fact>
        <Fact label="Deadline">{shortDate(p.deadline)}</Fact>
        <Fact label="Eligible spend">
          {inr(p.eligibleSpend)}
          <span className="mt-0.5 block text-[10.5px] font-normal text-slate-500">
            {p.eligibleTxnCount} transaction{p.eligibleTxnCount === 1 ? '' : 's'}
          </span>
        </Fact>
        {p.threshold > 0 && (
          <Fact label="Unlock target">
            {inr(p.threshold)}
            <span className="mt-0.5 block text-[10.5px] font-normal text-slate-500">{inr(p.remainingToThreshold)} remaining</span>
          </Fact>
        )}
        {(kind === 'earning' || kind === 'waiver') && <Fact label="Rate">{earningRate(p)}</Fact>}
        {p.cap != null && (
          <Fact label="Cap">
            {inr(p.cap)}
            {p.capRemaining != null && <span className="mt-0.5 block text-[10.5px] font-normal text-slate-500">{inr(p.capRemaining)} left</span>}
          </Fact>
        )}
        {p.earnedValue != null && <Fact label="Value this period">{inr(p.earnedValue)}</Fact>}
        {p.earnedPoints != null && <Fact label="Points this period">{p.earnedPoints.toLocaleString('en-IN')}</Fact>}
      </dl>

      <div className="mt-3 grid gap-1.5 text-[11.5px] leading-relaxed text-slate-400 sm:grid-cols-2">
        <div>
          <span className="font-medium text-slate-300">Counts toward it: </span>
          {p.includeAll
            ? 'All purchase categories'
            : p.eligibleCategories.length
              ? p.eligibleCategories.map(titleCase).join(', ')
              : 'No category configured'}
        </div>
        {p.excludedCategories.length > 0 && (
          <div>
            <span className="font-medium text-slate-300">Excluded: </span>
            {p.excludedCategories.map(titleCase).join(', ')}
          </div>
        )}
      </div>

      {p.explanation.length > 0 && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-[11.5px] font-medium text-slate-400 transition-colors hover:text-slate-200">
            How this is calculated
          </summary>
          <ul className="mt-1.5 space-y-0.5 text-[11.5px] leading-relaxed text-slate-400">
            {p.explanation.map((e, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-slate-600">•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {p.redemption && (
        <div className="mt-2 text-[11.5px] leading-relaxed text-slate-400">
          <span className="font-medium text-slate-300">How to use it: </span>
          {p.redemption}
        </div>
      )}
      {p.expiryRules && (
        <div className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
          <span className="font-medium text-slate-300">Expiry: </span>
          {p.expiryRules}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <Pill tone={confidenceTone(p.officialSource.confidence)}>Source: {p.officialSource.confidence}</Pill>
        {p.officialSource.label && <span className="text-slate-500">{p.officialSource.label}</span>}
        {p.officialSource.url && (
          <a href={p.officialSource.url} target="_blank" rel="noreferrer" className="font-medium text-emerald-400 hover:underline">
            Open source ↗
          </a>
        )}
      </div>

      {p.requiresActivation && (
        <div className="mt-3 rounded-lg bg-violet-500/10 px-3 py-2 text-[11.5px] text-violet-300">
          Activate this benefit on the issuer’s app or website before using it.
        </div>
      )}
    </div>
  );
}

function EarningTable({ rows }: { rows: BenefitProgress[] }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-800/80">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-slate-800 bg-slate-900/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:grid-cols-[minmax(0,1fr)_130px_110px]">
        <span>Where you spend</span>
        <span className="hidden sm:block">You earn</span>
        <span className="text-right">This period</span>
      </div>
      {rows.map((p) => (
        <div
          key={p.benefitId}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-slate-800/60 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_130px_110px]"
        >
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium text-slate-200">{benefitTitle(p)}</div>
            <div className="truncate text-[10.5px] text-slate-500">
              {earningScope(p)}
              {p.cap != null ? ` · cap ${inr(p.cap, { decimals: 0 })}` : ''}
            </div>
          </div>
          <div className="hidden text-[11.5px] text-slate-300 sm:block">{earningRate(p)}</div>
          <div className="text-right">
            <span className="tabnum text-[12px] font-medium text-emerald-400">{earningValue(p) ?? '—'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Summary({ label, value, hint, accent = false }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-slate-900/40 px-4 py-3 ${accent ? 'border-emerald-500/25' : 'border-slate-800/80'}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className={`mt-1 tabnum text-[22px] font-semibold leading-tight ${accent ? 'text-emerald-400' : 'text-slate-50'}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function GroupHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h3>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${
        active
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-[12px] font-medium text-slate-200">{children}</dd>
    </div>
  );
}
