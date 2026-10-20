import { useRef, useState } from 'react';
import { api, uploadStatement, UploadError } from '../lib/api.ts';
import type { PendingImport, UserCard } from '../lib/types.ts';
import { Button, Modal, Pill } from './ui.tsx';
import { inr, shortDate, titleCase } from '../lib/format.ts';

export function UploadModal({
  open,
  onClose,
  cards,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  cards: UserCard[];
  onImported: () => void;
}) {
  const [cardId, setCardId] = useState<number | null>(cards[0]?.id ?? null);
  const [queue, setQueue] = useState<File[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ file: string; count: number }[]>([]);
  const [progress, setProgress] = useState<string>('');
  const [locked, setLocked] = useState<{ file: File; index: number; files: File[] } | null>(null);
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCard = cardId ?? cards[0]?.id ?? null;

  function reset() {
    setQueue([]);
    setPending(null);
    setErr(null);
    setDone([]);
    setProgress('');
    setLocked(null);
    setPassword('');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function start(files: File[], targetCard: number, pw?: string) {
    setBusy(true);
    setErr(null);
    const results = done.slice();
    for (let i = 0; i < files.length; i++) {
      setProgress(`Parsing ${i + 1} of ${files.length}: ${files[i].name}`);
      try {
        const p = (await uploadStatement(targetCard, files[i], pw)) as PendingImport;
        setLocked(null);
        setPassword('');
        setPending(p);
        setQueue(files.slice(i + 1));
        setBusy(false);
        return;
      } catch (e) {
        if (e instanceof UploadError && e.needsPassword) {
          setLocked({ file: files[i], index: i, files });
          setPassword('');
          setBusy(false);
          return;
        }
        setErr(`${files[i].name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setDone(results);
    setBusy(false);
  }

  async function commit() {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/statements/pending/${pending.pendingId}/commit`);
      setDone((d) => [...d, { file: pending.fileName, count: pending.importedCount }]);
      onImported();
      const next = queue;
      setPending(null);
      if (next.length) {
        await start(next, activeCard!);
      } else {
        setProgress('');
        setBusy(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function discard() {
    if (!pending) return;
    setBusy(true);
    try {
      await api.del(`/statements/pending/${pending.pendingId}`);
    } catch {
      /* ignore */
    }
    const next = queue;
    setPending(null);
    if (next.length) await start(next, activeCard!);
    else {
      setProgress('');
      setBusy(false);
    }
  }

  function close() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Upload statement PDF" width="max-w-3xl">
      {cards.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-slate-500">Add a card first, then upload its statements.</div>
      ) : locked ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
            <span className="font-medium">{locked.file.name}</span> is password-protected. Enter its password to continue.
            Statement passwords are usually your date of birth (DDMMYYYY) or PAN.
          </div>
          <label className="block text-[12px] font-medium text-slate-600">
            PDF password
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password && activeCard) {
                  setErr(null);
                  void start(locked.files, activeCard, password);
                }
              }}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
              placeholder="Password for this PDF"
            />
          </label>
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{err}</div>}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setLocked(null);
                setPassword('');
                setErr(null);
              }}
              disabled={busy}
            >
              Skip this file
            </Button>
            <Button
              onClick={() => {
                if (activeCard && password) {
                  setErr(null);
                  void start(locked.files, activeCard, password);
                }
              }}
              disabled={busy || !password}
            >
              {busy ? 'Unlocking…' : 'Unlock & parse'}
            </Button>
          </div>
        </div>
      ) : !pending ? (
        <div className="space-y-4">
          <label className="block text-[12px] font-medium text-slate-600">
            Which card is this statement for?
            <select
              value={activeCard ?? ''}
              onChange={(e) => setCardId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[13px] font-normal outline-none focus:border-emerald-400"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname || c.cardName}
                  {c.last4 ? ` ••${c.last4}` : ''} — {c.issuer}
                </option>
              ))}
            </select>
          </label>

          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-slate-50/60 px-6 py-10 text-center hover:border-emerald-300 hover:bg-emerald-50/40"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
              if (files.length && activeCard) void start(files, activeCard);
            }}
          >
            <div className="text-[14px] font-medium text-slate-700">Drop PDF statements here</div>
            <div className="mt-1 text-[12.5px] text-slate-500">or click to browse. One or many files at once.</div>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length && activeCard) void start(files, activeCard);
              }}
            />
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            Nothing is saved until you review the parsed rows and press <span className="font-medium">Import</span>. Duplicate rows are detected
            automatically across statements.
          </div>

          {progress && <div className="text-[12.5px] text-slate-500">{progress}</div>}
          {done.length > 0 && (
            <div className="space-y-1">
              {done.map((d) => (
                <div key={d.file} className="flex items-center gap-2 text-[12.5px] text-emerald-700">
                  <span>✓</span> Imported {d.count} transactions from {d.file}
                </div>
              ))}
            </div>
          )}
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{err}</div>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={pending.duplicateCount > 0 ? 'amber' : 'green'}>
              {pending.importedCount} new{queue.length ? ` · ${queue.length} file(s) queued` : ''}
            </Pill>
            {pending.duplicateCount > 0 && <Pill tone="amber">{pending.duplicateCount} duplicates skipped</Pill>}
            {pending.skippedCount > 0 && <Pill tone="neutral">{pending.skippedCount} rows ignored</Pill>}
            <Pill tone={pending.parseConfidence >= 0.8 ? 'green' : pending.parseConfidence >= 0.6 ? 'amber' : 'red'}>
              Parse confidence {(pending.parseConfidence * 100).toFixed(0)}%
            </Pill>
            {pending.likelyScanned && <Pill tone="red">Looks like a scanned PDF</Pill>}
          </div>

          <div className="text-[12.5px] text-slate-500">
            {pending.fileName} · period {shortDate(pending.periodStart)} → {shortDate(pending.periodEnd)}
          </div>

          {pending.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
              {pending.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-200">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pending.transactions.map((t, i) => (
                  <tr key={i} className={`border-t border-ink-100 ${t.isDuplicate ? 'opacity-40' : ''}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 tabnum text-slate-500">{shortDate(t.txn_date)}</td>
                    <td className="max-w-[280px] truncate px-3 py-1.5 text-slate-800" title={t.description}>
                      {t.description}
                      {t.isDuplicate && <span className="ml-2 text-[11px] text-amber-600">duplicate</span>}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500">{titleCase(t.category)}</td>
                    <td className={`whitespace-nowrap px-3 py-1.5 text-right tabnum ${t.direction === 'credit' ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {t.direction === 'credit' ? '+' : '−'}
                      {inr(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{err}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={discard} disabled={busy}>
              Discard
            </Button>
            <Button onClick={commit} disabled={busy || pending.importedCount === 0}>
              {busy ? 'Importing…' : `Import ${pending.importedCount} transactions`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
