import { useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { Transaction, UserCard } from '../lib/types.ts';
import { Panel, Pill, Spinner, ErrorBox, EmptyState, Button, Modal } from '../components/ui.tsx';
import { inr, shortDate, titleCase } from '../lib/format.ts';

interface TxnResponse {
  transactions: Transaction[];
  count: number;
}

export function TransactionsView({ version, cards, onChange }: { version: number; cards: UserCard[]; onChange: () => void }) {
  const [cardId, setCardId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [eligible, setEligible] = useState<string>('');
  const [edit, setEdit] = useState<Transaction | null>(null);

  const meta = useAsync(() => api.get<{ categories: string[]; categoryLabels: Record<string, string> }>('/meta'), []);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (cardId) p.set('cardId', cardId);
    if (category) p.set('category', category);
    if (month) p.set('month', month);
    if (search) p.set('search', search);
    if (eligible) p.set('eligible', eligible);
    p.set('limit', '500');
    return p.toString();
  }, [cardId, category, month, search, eligible]);

  const txns = useAsync(() => api.get<TxnResponse>(`/transactions?${qs}`), [version, qs]);
  const rows = txns.data?.transactions ?? [];
  const labels = meta.data?.categoryLabels ?? {};

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of rows) set.add(t.txnDate.slice(0, 7));
    return [...set].sort().reverse();
  }, [rows]);

  const totals = useMemo(() => {
    let spend = 0;
    let credits = 0;
    for (const t of rows) {
      if (t.direction === 'credit') credits += t.amount;
      else if (t.txnType === 'purchase') spend += t.amount;
    }
    return { spend, credits };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-100">Transactions</h1>
          <p className="text-[13px] text-slate-400">
            {rows.length} shown · purchases {inr(totals.spend, { decimals: 0 })} · credits {inr(totals.credits, { decimals: 0 })}
          </p>
        </div>
      </div>

      <Panel padded={false}>
        <div className="flex flex-wrap gap-2 border-b border-slate-800 p-3">
          <select
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          >
            <option value="">All cards</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname || c.cardName}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          >
            <option value="">All categories</option>
            {(meta.data?.categories ?? []).map((c) => (
              <option key={c} value={c}>
                {labels[c] ?? titleCase(c)}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          >
            <option value="">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {new Date(m + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </option>
            ))}
          </select>
          <select
            value={eligible}
            onChange={(e) => setEligible(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          >
            <option value="">All</option>
            <option value="true">Purchases only</option>
            <option value="false">Non-spend only</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search merchant…"
            className="min-w-[180px] flex-1 rounded-lg border border-slate-800 px-3 py-1.5 text-[12.5px] outline-none focus:border-emerald-500"
          />
        </div>

        {txns.loading && !txns.data ? (
          <Spinner />
        ) : txns.error ? (
          <div className="p-4">
            <ErrorBox message={txns.error} onRetry={txns.reload} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No transactions" body="Upload a statement, or adjust the filters." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-slate-800/50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Merchant / description</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Card</th>
                  <th className="px-4 py-2.5 font-medium">Eligible for</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-2 tabnum text-slate-400">{shortDate(t.txnDate)}</td>
                    <td className="max-w-[320px] px-4 py-2">
                      <div className="truncate font-medium text-slate-200">{t.merchant}</div>
                      <div className="truncate text-[11.5px] text-slate-400" title={t.description}>
                        {t.description}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Pill tone={t.categorySource === 'manual' ? 'violet' : t.categorySource === 'rule' ? 'blue' : 'neutral'}>
                        {labels[t.category] ?? titleCase(t.category)}
                      </Pill>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-400">{t.cardNickname || t.cardName}</td>
                    <td className="px-4 py-2">
                      {t.eligibleFor.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {t.eligibleFor.slice(0, 2).map((e, i) => (
                            <span key={i} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] text-emerald-300" title={e}>
                              {e.length > 24 ? e.slice(0, 22) + '…' : e}
                            </span>
                          ))}
                          {t.eligibleFor.length > 2 && <span className="text-[10.5px] text-slate-400">+{t.eligibleFor.length - 2}</span>}
                        </div>
                      )}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-2 text-right tabnum font-medium ${t.direction === 'credit' ? 'text-emerald-400' : 'text-slate-200'}`}>
                      {t.direction === 'credit' ? '+' : '−'}
                      {inr(t.amount)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button onClick={() => setEdit(t)} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200" title="Edit">
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <EditTxnModal txn={edit} categories={meta.data?.categories ?? []} labels={labels} onClose={() => setEdit(null)} onSaved={onChange} />
    </div>
  );
}

function EditTxnModal({
  txn,
  categories,
  labels,
  onClose,
  onSaved,
}: {
  txn: Transaction | null;
  categories: string[];
  labels: Record<string, string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedKey, setLoadedKey] = useState(0);
  const key = txn?.id ?? 0;
  if (txn && loadedKey !== key) {
    setLoadedKey(key);
    setCategory(txn.category);
    setMerchant(txn.merchant);
  }

  async function save() {
    if (!txn) return;
    setBusy(true);
    await api.patch(`/transactions/${txn.id}`, { category, merchant });
    setBusy(false);
    onSaved();
    onClose();
  }

  return (
    <Modal open={!!txn} onClose={onClose} title="Recategorise transaction">
      <div className="mb-3 rounded-lg bg-slate-800/50 px-3 py-2 text-[12.5px] text-slate-300">
        <div className="font-medium text-slate-200">{txn?.description}</div>
        <div className="mt-0.5 tabnum text-slate-400">
          {shortDate(txn?.txnDate ?? '')} · {inr(txn?.amount ?? 0)} {txn?.direction}
        </div>
      </div>
      <div className="space-y-3">
        <label className="block text-[12px] font-medium text-slate-300">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {labels[c] ?? titleCase(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12px] font-medium text-slate-300">
          Merchant
          <input
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-800 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-500"
          />
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Modal>
  );
}
