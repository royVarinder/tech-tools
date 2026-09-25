const IST_TIME_ZONE = "Asia/Kolkata";

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Formats a date/ISO string as "DD MMM YYYY, hh:mm am/pm" in India Standard Time. */
export function formatIST(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${dateTimeFormatter.format(date)} IST`;
}

/** Formats a date/ISO string as "DD MMM YYYY" in India Standard Time. */
export function formatISTDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return dateFormatter.format(date);
}
