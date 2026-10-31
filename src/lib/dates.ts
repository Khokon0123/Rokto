import { APP_TIME_ZONE } from "@/config/app";

// Bangladesh is UTC+6 with no DST. Anything a person thinks of as "today" must be computed in
// Asia/Dhaka, or between 00:00 and 06:00 local time "today" is still yesterday (F11, D6).
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD for the given instant, in Bangladesh time. */
export function dhakaDate(at: Date = new Date()): string {
  return dayFormat.format(at);
}

/** Today's date in Bangladesh, YYYY-MM-DD. Use for date-picker `max` and "not in the future" checks. */
export function todayIso(): string {
  return dhakaDate();
}
