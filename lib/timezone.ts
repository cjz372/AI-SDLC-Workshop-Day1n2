// Singapore (Asia/Singapore) is UTC+8 with no daylight saving, so a fixed offset is exact.
// Due dates are stored as Singapore wall-clock strings: 'YYYY-MM-DDTHH:mm'.
export const SINGAPORE_TIMEZONE = 'Asia/Singapore';
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Current instant. The only sanctioned place to call `new Date()`. */
export function getSingaporeNow(): Date {
  return new Date();
}

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

/** Wall-clock components of an instant, as seen in Singapore. */
export function singaporeParts(date: Date) {
  const shifted = new Date(date.getTime() + SGT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** Format an instant as Singapore local 'YYYY-MM-DDTHH:mm'. */
export function formatSingaporeDate(date: Date): string {
  const p = singaporeParts(date);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Singapore local 'YYYY-MM-DDTHH:mm:ss' (second precision, used for updated_at ordering). */
export function formatSingaporeTimestamp(date: Date): string {
  const sec = new Date(date.getTime() + SGT_OFFSET_MS).getUTCSeconds();
  return `${formatSingaporeDate(date)}:${pad(sec)}`;
}

/** Singapore calendar date 'YYYY-MM-DD' of an instant. */
export function formatSingaporeDay(date: Date): string {
  return formatSingaporeDate(date).slice(0, 10);
}

/** Singapore local 'YYYY-MM-DDTHH:mm' for the current moment. */
export function nowSingaporeLocal(): string {
  return formatSingaporeDate(getSingaporeNow());
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

export function isValidSingaporeLocal(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = LOCAL_RE.exec(value);
  if (!m) return false;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d && h < 24 && mi < 60;
}

/** Parse a Singapore local string into the instant it denotes. */
export function parseSingaporeLocal(value: string): Date {
  const m = LOCAL_RE.exec(value);
  if (!m) throw new Error(`Invalid Singapore datetime: ${value}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - SGT_OFFSET_MS);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/** True when `due` (Singapore local) is at least `minMinutes` after now. */
export function isDueDateInFuture(due: string, minMinutes = 1, now: Date = getSingaporeNow()): boolean {
  return parseSingaporeLocal(due).getTime() >= now.getTime() + minMinutes * MINUTE_MS - 1;
}

/** Days in a month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
