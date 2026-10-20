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
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-[13px] font-bold text-white">CW</span>
              <span className="text-[14px] font-semibold tracking-tight">CARDWISE</span>
            </div>
            <div className="hidden text-[13px] font-medium text-slate-500 lg:block">{NAV.find((n) => n.key === view)?.label}</div>
            <div className="flex items-center gap-2">
              {(view === 'overview' || view === 'benefits') && (
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-400"
                >
                  {PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setUploadOpen(true)}
                className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={userCards.length === 0}
              >
                Upload
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-emerald-700"
              >
                Add card
              </button>
            </div>
          </div>
          <MobileNav view={view} setView={setView} />
        </header>

        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
          <div className="mx-auto max-w-[1200px]">
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
            {view === 'benefits' && <BenefitsView version={version} period={period} onChange={refresh} />}
            {view === 'transactions' && <TransactionsView version={version} cards={userCards} onChange={refresh} />}
            {view === 'catalog' && <CatalogView version={version} onAdd={() => setAddOpen(true)} />}
            {view === 'sources' && <SourcesView version={version} onChanged={refresh} />}
          </div>
        </main>

        <footer className="border-t border-ink-200 px-4 py-3 text-center text-[11.5px] text-slate-400 lg:px-6">
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
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-[13px] font-bold text-white">CW</span>
      <div>
        <div className="text-[14px] font-semibold leading-none tracking-tight text-slate-900">CARDWISE</div>
        <div className="mt-0.5 text-[10.5px] text-slate-400">Card benefits optimizer</div>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, cardCount }: { view: ViewKey; setView: (v: ViewKey) => void; cardCount: number }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-white lg:flex lg:flex-col">
      <div className="px-4 py-4">
        <Brand />
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((n) => (
          <button
            key={n.key}
            onClick={() => setView(n.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
              view === n.key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span className={`w-4 text-center ${view === n.key ? 'text-emerald-600' : 'text-slate-400'}`}>{n.icon}</span>
            {n.label}
            {n.key === 'cards' && cardCount > 0 && (
              <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[10.5px] text-slate-500">{cardCount}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="px-3 py-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-slate-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
    <div className="flex gap-1 overflow-x-auto border-t border-ink-100 px-2 py-1.5 lg:hidden">
      {NAV.map((n) => (
        <button
          key={n.key}
          onClick={() => setView(n.key)}
          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-medium ${
            view === n.key ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'
          }`}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}
