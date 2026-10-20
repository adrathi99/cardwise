export type PeriodType =
  | 'calendar_year'
  | 'financial_year'
  | 'anniversary_year'
  | 'monthly'
  | 'quarterly'
  | 'rolling_12m';

export interface Period {
  start: string; // YYYY-MM-DD inclusive
  end: string; // YYYY-MM-DD inclusive
  label: string;
  nextReset: string; // first day after end
  periodType: PeriodType;
  basedOnAnniversary: boolean;
}

export function parseYMD(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function ymd(d: Date): string {
  return `${d.getUTCFullYear().toString().padStart(4, '0')}-${(d.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
}

export function addMonths(d: Date, months: number): Date {
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTarget));
  return target;
}

export function addDays(d: Date, days: number): Date {
  const c = new Date(d.getTime());
  c.setUTCDate(c.getUTCDate() + days);
  return c;
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getPeriod(periodType: PeriodType, refDate: Date, anniversaryDate?: Date | null): Period {
  switch (periodType) {
    case 'monthly': {
      const start = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), 1));
      const end = endOfMonth(refDate);
      return {
        start: ymd(start),
        end: ymd(end),
        label: `${MONTHS[refDate.getUTCMonth()]} ${refDate.getUTCFullYear()}`,
        nextReset: ymd(addDays(end, 1)),
        periodType,
        basedOnAnniversary: false,
      };
    }
    case 'quarterly': {
      const q = Math.floor(refDate.getUTCMonth() / 3);
      const start = new Date(Date.UTC(refDate.getUTCFullYear(), q * 3, 1));
      const end = endOfMonth(new Date(Date.UTC(refDate.getUTCFullYear(), q * 3 + 2, 1)));
      return {
        start: ymd(start),
        end: ymd(end),
        label: `Q${q + 1} ${refDate.getUTCFullYear()}`,
        nextReset: ymd(addDays(end, 1)),
        periodType,
        basedOnAnniversary: false,
      };
    }
    case 'financial_year': {
      const y = refDate.getUTCMonth() >= 3 ? refDate.getUTCFullYear() : refDate.getUTCFullYear() - 1;
      const start = new Date(Date.UTC(y, 3, 1));
      const end = new Date(Date.UTC(y + 1, 2, 31));
      return {
        start: ymd(start),
        end: ymd(end),
        label: `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`,
        nextReset: ymd(addDays(end, 1)),
        periodType,
        basedOnAnniversary: false,
      };
    }
    case 'anniversary_year': {
      if (!anniversaryDate) {
        const p = getPeriod('calendar_year', refDate);
        return { ...p, periodType: 'anniversary_year', basedOnAnniversary: false };
      }
      const ay = anniversaryDate.getUTCFullYear();
      let start = new Date(Date.UTC(refDate.getUTCFullYear(), anniversaryDate.getUTCMonth(), anniversaryDate.getUTCDate()));
      if (start > refDate) start = new Date(Date.UTC(refDate.getUTCFullYear() - 1, anniversaryDate.getUTCMonth(), anniversaryDate.getUTCDate()));
      void ay;
      const end = addDays(addMonths(start, 12), -1);
      return {
        start: ymd(start),
        end: ymd(end),
        label: `Card year from ${ymd(start)}`,
        nextReset: ymd(addDays(end, 1)),
        periodType,
        basedOnAnniversary: true,
      };
    }
    case 'rolling_12m': {
      const start = addDays(addMonths(refDate, -12), 1);
      return {
        start: ymd(start),
        end: ymd(refDate),
        label: `Rolling 12 months to ${ymd(refDate)}`,
        nextReset: ymd(addDays(refDate, 1)),
        periodType,
        basedOnAnniversary: false,
      };
    }
    case 'calendar_year':
    default: {
      const start = new Date(Date.UTC(refDate.getUTCFullYear(), 0, 1));
      const end = new Date(Date.UTC(refDate.getUTCFullYear(), 11, 31));
      return {
        start: ymd(start),
        end: ymd(end),
        label: String(refDate.getUTCFullYear()),
        nextReset: ymd(addDays(end, 1)),
        periodType: 'calendar_year',
        basedOnAnniversary: false,
      };
    }
  }
}
