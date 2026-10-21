import { useState } from 'react';
import { api } from '../lib/api.ts';
import { useAsync } from '../lib/useAsync.ts';
import type { Statement, UserCard } from '../lib/types.ts';
import { Panel, Button, Pill, ConfidencePill, VerificationPill, Spinner, ErrorBox, EmptyState, Modal } from '../components/ui.tsx';
import { inr, shortDate } from '../lib/format.ts';

export function MyCardsView({
  version,
  onChanged,
  onAddCard,
  onUpload,
  cards,
}: {
  version: number;
  onChanged: () => void;
  onAddCard: () => void;
  onUpload: () => void;
  cards: UserCard[];
}) {
  const statements = useAsync(() => api.get<Statement[]>('/statements'), [version]);
  const [edit, setEdit] = useState<UserCard | null>(null);

  if (statements.loading && !statements.data) return <Spinner />;
  if (statements.error) return <ErrorBox message={statements.error} onRetry={statements.reload} />;
  const stmts = statements.data ?? [];

  async function remove(card: UserCard) {
    if (!confirm(`Remove “${card.nickname || card.cardName}” and all its imported transactions?`)) return;
    await api.del(`/user-cards/${card.id}`);
    onChanged();
  }

  async function removeStatement(id: number) {
    if (!confirm('Delete this statement and its transactions?')) return;
    await api.del(`/statements/${id}`);
    onChanged();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-slate-100">My Cards</h1>
          <p className="text-[13px] text-slate-400">Your portfolio and imported statements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onUpload} disabled={cards.length === 0}>
            Upload statement
          </Button>
          <Button onClick={onAddCard}>Add card</Button>
        </div>
      </div>

      {cards.length === 0 ? (
        <EmptyState title="No cards yet" body="Add a card from the catalogue or as a custom card." action={<Button onClick={onAddCard}>Add a card</Button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cards.map((c) => {
            const cardStmts = stmts.filter((s) => s.user_card_id === c.id);
            return (
              <Panel key={c.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-slate-100">{c.nickname || c.cardName}</span>
                      {c.last4 && <span className="text-[12px] text-slate-400">••{c.last4}</span>}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-slate-400">
                      {c.issuer}
                      {c.network ? ` · ${c.network}` : ''} · {c.tier}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ConfidencePill confidence={c.dataConfidence} />
                      <VerificationPill status={c.verificationStatus} />
                      {c.isCustom === 1 && <Pill tone="violet">Custom</Pill>}
                      {c.anniversaryDate && <Pill tone="neutral">Anniv {shortDate(c.anniversaryDate)}</Pill>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[12px] text-slate-400">Annual fee</div>
                    <div className="tabnum text-[13px] font-medium text-slate-200">{c.annualFee ? inr(c.annualFee) : 'Nil'}</div>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-800 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11.5px] font-medium uppercase tracking-wide text-slate-400">Statements</span>
                    <span className="text-[11.5px] text-slate-400">{cardStmts.length} imported</span>
                  </div>
                  {cardStmts.length === 0 ? (
                    <div className="text-[12.5px] text-slate-400">No statements uploaded yet.</div>
                  ) : (
                    <div className="space-y-1">
                      {cardStmts.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/50 px-2.5 py-1.5">
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-medium text-slate-200" title={s.filename}>
                              {s.filename}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {shortDate(s.billing_period_start)} → {shortDate(s.billing_period_end)} · {s.imported_count} txns
                            </div>
                          </div>
                          <button
                            onClick={() => removeStatement(s.id)}
                            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                            title="Delete statement"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex justify-end gap-2 border-t border-slate-800 pt-3">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(c)}>
                    Remove
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <EditCardModal card={edit} onClose={() => setEdit(null)} onSaved={onChanged} />
    </div>
  );
}

function EditCardModal({ card, onClose, onSaved }: { card: UserCard | null; onClose: () => void; onSaved: () => void }) {
  const [nickname, setNickname] = useState('');
  const [last4, setLast4] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [busy, setBusy] = useState(false);
  const key = card?.id ?? 0;
  const [loadedKey, setLoadedKey] = useState(0);
  if (card && loadedKey !== key) {
    setLoadedKey(key);
    setNickname(card.nickname ?? '');
    setLast4(card.last4 ?? '');
    setAnniversary(card.anniversaryDate ?? '');
  }

  async function save() {
    if (!card) return;
    setBusy(true);
    await api.patch(`/user-cards/${card.id}`, { nickname, last4: last4 || null, anniversaryDate: anniversary || null });
    setBusy(false);
    onSaved();
    onClose();
  }

  return (
    <Modal open={!!card} onClose={onClose} title={`Edit ${card?.cardName ?? ''}`}>
      <div className="space-y-3">
        <label className="block text-[12px] font-medium text-slate-300">
          Nickname
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-800 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-500"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[12px] font-medium text-slate-300">
            Last 4 digits
            <input
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              className="mt-1 w-full rounded-lg border border-slate-800 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-500"
            />
          </label>
          <label className="text-[12px] font-medium text-slate-300">
            Anniversary
            <input
              type="date"
              value={anniversary}
              onChange={(e) => setAnniversary(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-800 px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-500"
            />
          </label>
        </div>
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
