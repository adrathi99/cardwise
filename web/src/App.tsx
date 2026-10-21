import { useState } from 'react';
import { api } from './lib/api.ts';
import { useAsync } from './lib/useAsync.ts';
import type { UserCard } from './lib/types.ts';
import { OverviewView } from './views/Overview.tsx';
import { MyCardsView } from './views/MyCards.tsx';
import { BenefitsView } from './views/Benefits.tsx';
import { TransactionsView } from './views/Transactions.tsx';
import { CatalogView } from './views/Catalog.tsx';
import { SourcesView } from './views/Sources.tsx';
import { AddCardModal } from './components/AddCardModal.tsx';
import { UploadModal } from './components/UploadModal.tsx';

type ViewKey = 'overview' | 'cards' | 'benefits' | 'transactions' | 'catalog' | 'sources';

const NAV: { key: ViewKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '◎' },
  { key: 'cards', label: 'My Cards', icon: '▤' },
  { key: 'benefits', label: 'Benefits', icon: '★' },
  { key: 'transactions', label: 'Transactions', icon: '⇄' },
  { key: 'catalog', label: 'Catalogue', icon: '⌗' },
  { key: 'sources', label: 'Data & Settings', icon: '⚙' },
];

const PERIODS: { value: string; label: string }[] = [
  { value: 'financial_year', label: 'This FY' },
  { value: 'calendar_year', label: 'This year' },
  { value: 'quarterly', label: 'This quarter' },
  { value: 'monthly', label: 'This month' },
  { value: 'rolling_12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

export default function App() {
  const [view, setView] = useState<ViewKey>('overview');
  const [version, setVersion] = useState(0);
  const [period, setPeriod] = useState('financial_year');
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const cards = useAsync(() => api.get<UserCard[]>('/user-cards'), [version]);
  const userCards = cards.data ?? [];

  const refresh = () => setVersion((v) => v + 1);

  return (
    <div className="min-h-full lg:flex">
      <Sidebar view={view} setView={setView} cardCount={userCards.length} />

      <div className="flex min-h-screen flex-1 flex-col lg:min-h-full">
        <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-[13px] font-bold text-emerald-950 shadow-[0_6px_18px_-8px_rgba(16,185,129,0.9)]">
                C
              </span>
              <span className="text-[14px] font-semibold tracking-tight text-slate-100">CARDWISE</span>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-[12.5px] font-medium text-slate-500">{NAV.find((n) => n.key === view)?.label}</span>
              <span className="h-1 w-1 rounded-full bg-slate-700" />
              <span className="text-[11.5px] text-slate-600">local-first</span>
            </div>
            <div className="flex items-center gap-2">
              {(view === 'overview' || view === 'benefits') && (
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-lg border border-slate-700/80 bg-slate-900/70 px-2.5 py-1.5 text-[12.5px] text-slate-200 outline-none transition-colors hover:border-slate-600 focus:border-emerald-500"
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value} className="bg-slate-900">
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setUploadOpen(true)}
                className="rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-1.5 text-[12.5px] font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800/70 disabled:opacity-40"
                disabled={userCards.length === 0}
              >
                Upload
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-950 shadow-[0_10px_28px_-14px_rgba(16,185,129,0.9)] transition-colors hover:bg-emerald-400"
              >
                Add card
              </button>
            </div>
          </div>
          <MobileNav view={view} setView={setView} />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1240px]">
            {view === 'overview' && (
              <OverviewView version={version} period={period} onAddCard={() => setAddOpen(true)} onUpload={() => setUploadOpen(true)} />
            )}
            {view === 'cards' && (
              <MyCardsView
                version={version}
                onChanged={refresh}
                onAddCard={() => setAddOpen(true)}
                onUpload={() => setUploadOpen(true)}
                cards={userCards}
              />
            )}
            {view === 'benefits' && <BenefitsView version={version} period={period} />}
            {view === 'transactions' && <TransactionsView version={version} cards={userCards} onChange={refresh} />}
            {view === 'catalog' && <CatalogView version={version} onAdd={() => setAddOpen(true)} />}
            {view === 'sources' && <SourcesView version={version} onChanged={refresh} />}
          </div>
        </main>

        <footer className="border-t border-slate-800/70 px-4 py-4 text-center text-[11.5px] text-slate-600 lg:px-6">
          CARDWISE runs locally. Benefits are computed deterministically from the statements you upload — not financial advice.
        </footer>
      </div>

      <AddCardModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} cards={userCards} onImported={refresh} />
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-[14px] font-bold text-emerald-950 shadow-[0_10px_26px_-12px_rgba(16,185,129,0.9)]">
        C
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/25 to-transparent" />
      </span>
      <div>
        <div className="text-[14px] font-semibold leading-none tracking-tight text-slate-100">CARDWISE</div>
        <div className="mt-1 text-[10.5px] text-slate-500">Card benefits optimizer</div>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, cardCount }: { view: ViewKey; setView: (v: ViewKey) => void; cardCount: number }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-800/70 bg-slate-950/50 backdrop-blur-xl lg:flex lg:flex-col">
      <div className="px-4 py-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all ${
                active
                  ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span className={`w-4 text-center text-[13px] ${active ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-400'}`}>
                {n.icon}
              </span>
              {n.label}
              {n.key === 'cards' && cardCount > 0 && (
                <span
                  className={`ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] tabnum ${
                    active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {cardCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-3 pb-4">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-slate-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Local-first
          </div>
          Statements never leave this device.
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ view, setView }: { view: ViewKey; setView: (v: ViewKey) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-t border-slate-800/70 px-2 py-1.5 lg:hidden">
      {NAV.map((n) => (
        <button
          key={n.key}
          onClick={() => setView(n.key)}
          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
            view === n.key ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}
