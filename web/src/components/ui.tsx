import { type ReactNode } from 'react';

export function Panel({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-slate-900/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_24px_48px_-32px_rgba(0,0,0,0.9)] backdrop-blur-sm ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[14.5px] font-semibold tracking-tight text-slate-100">{children}</h2>
      {sub && <p className="mt-0.5 text-[12.5px] text-slate-400">{sub}</p>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-3.5 py-2 text-[13px]';
  const variants = {
    primary:
      'bg-emerald-500 text-emerald-950 shadow-[0_10px_28px_-14px_rgba(16,185,129,0.9)] hover:bg-emerald-400',
    secondary: 'border border-slate-700/80 bg-slate-900/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800/70',
    ghost: 'text-slate-300 hover:bg-slate-800/70 hover:text-slate-100',
    danger: 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20',
  }[variant];
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </button>
  );
}

const TONE: Record<string, string> = {
  neutral: 'bg-slate-800/70 text-slate-300 ring-slate-700/70',
  green: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
  red: 'bg-red-500/10 text-red-300 ring-red-500/30',
  blue: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
};

export function Pill({ children, tone = 'neutral', className = '' }: { children: ReactNode; tone?: keyof typeof TONE; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function confidenceTone(confidence: string): keyof typeof TONE {
  switch (confidence) {
    case 'high':
      return 'green';
    case 'medium':
      return 'blue';
    case 'indicative':
      return 'amber';
    default:
      return 'neutral';
  }
}

export function ConfidencePill({ confidence }: { confidence: string }) {
  return <Pill tone={confidenceTone(confidence)}>Data: {confidence}</Pill>;
}

export function VerificationPill({ status }: { status: string }) {
  if (status === 'verified') return <Pill tone="green">✓ Verified</Pill>;
  if (status === 'partially_verified') return <Pill tone="amber">Partially verified</Pill>;
  return <Pill tone="neutral">Unverified</Pill>;
}

const BAR: Record<string, string> = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_14px_rgba(16,185,129,0.45)]',
  amber: 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_14px_rgba(245,158,11,0.35)]',
  sky: 'bg-gradient-to-r from-sky-500 to-cyan-400 shadow-[0_0_14px_rgba(14,165,233,0.35)]',
  slate: 'bg-gradient-to-r from-slate-500 to-slate-400',
};

export function Progress({ value, tone = 'emerald', height = 8 }: { value: number; tone?: keyof typeof BAR; height?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-inset ring-white/5" style={{ height }}>
      <div className={`h-full rounded-full transition-[width] duration-700 ${BAR[tone]}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className={`mt-1.5 tabnum text-[23px] font-semibold leading-tight ${tone === 'accent' ? 'text-emerald-400' : 'text-slate-50'}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-[11.5px] leading-snug text-slate-400">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/80 bg-slate-900/40 px-6 py-14 text-center backdrop-blur-sm">
      <div className="text-[14px] font-medium text-slate-200">{title}</div>
      {body && <div className="mt-1.5 max-w-md text-[13px] leading-relaxed text-slate-400">{body}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[13px] text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
      <div className="font-medium">Couldn’t load data</div>
      <div className="mt-0.5 opacity-90">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[12px] font-medium hover:bg-red-500/20">
          Retry
        </button>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-md sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)] sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-5 py-3.5 backdrop-blur">
          <h3 className="text-[14px] font-semibold text-slate-100">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-700/80 text-[10px] font-semibold text-slate-300 ring-1 ring-inset ring-white/10">
        i
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-60 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[11.5px] font-normal leading-relaxed text-slate-200 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-800/80 ${className}`} />;
}
