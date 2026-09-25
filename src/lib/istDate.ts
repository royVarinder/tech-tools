const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Converts a "YYYY-MM-DD" date (interpreted as an India Standard Time calendar day) to a UTC Date boundary. */
export function istDayBoundary(dateStr: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match;
  const startUtcMs = Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0) - IST_OFFSET_MS;
  return new Date(endOfDay ? startUtcMs + 24 * 60 * 60 * 1000 - 1 : startUtcMs);
}

const istDayKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** Today's date as "YYYY-MM-DD" in India Standard Time. */
export function istTodayDateString(): string {
  return istDayKeyFormatter.format(new Date());
}
