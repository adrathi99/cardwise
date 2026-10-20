import { useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { CatalogCard } from '../lib/types.ts';
import { Button, Modal } from './ui.tsx';

export function AddCardModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const catalog = useAsync(() => api.get<CatalogCard[]>('/cards'), [open]);
  const [mode, setMode] = useState<'catalog' | 'custom'>('catalog');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CatalogCard | null>(null);
  const [nickname, setNickname] = useState('');
  const [last4, setLast4] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [customName, setCustomName] = useState('');
  const [customIssuer, setCustomIssuer] = useState('');
  const [customNetwork, setCustomNetwork] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = catalog.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => `${c.name} ${c.issuer} ${c.tier} ${c.network ?? ''}`.toLowerCase().includes(q));
  }, [catalog.data, search]);

  async function submitCatalog() {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post('/user-cards', {
        cardProductId: selected.id,
        nickname: nickname || selected.name,
        last4: last4 || null,
        anniversaryDate: anniversary || null,
      });
      onAdded();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCustom() {
    if (!customName.trim()) {
      setErr('Give your card a name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.post('/user-cards', {
        nickname: customName.trim(),
        last4: last4 || null,
        anniversaryDate: anniversary || null,
        customCard: {
          issuerName: customIssuer.trim() || 'Other',
          name: customName.trim(),
          variant: customNetwork.trim() || undefined,
        },
      });
      onAdded();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a card" width="max-w-2xl">
      <div className="mb-4 inline-flex rounded-lg border border-ink-200 bg-slate-50 p-0.5 text-[12.5px]">
        <button
          className={`rounded-md px-3 py-1.5 font-medium ${mode === 'catalog' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          onClick={() => setMode('catalog')}
        >
          From catalogue
        </button>
        <button
          className={`rounded-md px-3 py-1.5 font-medium ${mode === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          onClick={() => setMode('custom')}
        >
          Custom card
        </button>
      </div>

      {mode === 'catalog' ? (
        <div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search card or issuer…"
            className="mb-3 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] outline-none focus:border-emerald-400"
          />
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelected(c);
                  if (!nickname) setNickname(c.name);
                }}
                className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                  selected?.id === c.id ? 'border-emerald-400 bg-emerald-50/60' : 'border-ink-200 hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-slate-900">{c.name}</div>
                  <div className="truncate text-[12px] text-slate-500">
                    {c.issuer} · {c.tier} · {c.benefitCount} benefits
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-[11px] text-slate-400">{c.annualFee ? `₹${c.annualFee}/yr` : 'Free'}</div>
              </button>
            ))}
            {!catalog.loading && filtered.length === 0 && <div className="py-8 text-center text-[13px] text-slate-500">No cards match.</div>}
          </div>

          {selected && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
              <label className="col-span-2 text-[12px] font-medium text-slate-600">
                Nickname
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-[12px] font-medium text-slate-600">
                Last 4 digits (optional)
                <input
                  value={last4}
                  maxLength={4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
                />
              </label>
              <label className="text-[12px] font-medium text-slate-600">
                Card opened / anniversary (optional)
                <input
                  type="date"
                  value={anniversary}
                  onChange={(e) => setAnniversary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
                />
              </label>
              <div className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                Catalogue benefit data is unverified in this build — always confirm exact terms on the issuer’s official page.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-[12px] font-medium text-slate-600">
            Card name *
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Kotak League Platinum"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-[12px] font-medium text-slate-600">
            Issuer
            <input
              value={customIssuer}
              onChange={(e) => setCustomIssuer(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-[12px] font-medium text-slate-600">
            Network
            <input
              value={customNetwork}
              onChange={(e) => setCustomNetwork(e.target.value)}
              placeholder="Visa / Mastercard / RuPay"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-[12px] font-medium text-slate-600">
            Last 4 digits
            <input
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
            />
          </label>
          <label className="text-[12px] font-medium text-slate-600">
            Anniversary
            <input
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
            />
          </label>
          <div className="col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            Custom cards start with no benefits. Add them manually in Benefits, or use this for statements you want to track spend on.
          </div>
        </div>
      )}

      {err && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{err}</div>}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={mode === 'catalog' ? submitCatalog : submitCustom} disabled={busy || (mode === 'catalog' && !selected)}>
          {busy ? 'Adding…' : 'Add card'}
        </Button>
      </div>
    </Modal>
  );
}
