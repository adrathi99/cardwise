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
      className={`rounded-2xl border border-ink-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-16px_rgba(16,24,40,0.15)] ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{children}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-slate-500">{sub}</p>}
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
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-3.5 py-2 text-[13px]';
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'border border-ink-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
  }[variant];
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </button>
  );
}

const TONE: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
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
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  slate: 'bg-slate-400',
};

export function Progress({ value, tone = 'emerald', height = 8 }: { value: number; tone?: keyof typeof BAR; height?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full overflow-hidden rounded-full bg-slate-100" style={{ height }}>
      <div className={`h-full rounded-full transition-[width] duration-500 ${BAR[tone]}`} style={{ width: `${clamped}%` }} />
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
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 tabnum text-[22px] font-semibold leading-tight ${tone === 'accent' ? 'text-emerald-600' : 'text-slate-900'}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[12px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center">
      <div className="text-[14px] font-medium text-slate-700">{title}</div>
      {body && <div className="mt-1 max-w-md text-[13px] text-slate-500">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[13px] text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      <div className="font-medium">Couldn’t load data</div>
      <div className="mt-0.5 opacity-90">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-md border border-red-300 bg-white px-2 py-1 text-[12px] font-medium hover:bg-red-100">
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className={`max-h-[92vh] w-full ${width} overflow-y-auto rounded-t-2xl border border-ink-200 bg-white shadow-2xl sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-5 py-3.5">
          <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
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
      <span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">i</span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[11.5px] leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/70 ${className}`} />;
}
