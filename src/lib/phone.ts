import { PHONE_COUNTRY_CODE } from "@/config/app";
import { toLatinDigits } from "./digits";

/**
 * Accepts 01XXXXXXXXX, 8801XXXXXXXXX or +8801XXXXXXXXX (Latin or Bengali digits)
 * and returns E.164 (+8801XXXXXXXXX), or null if it is not a valid BD mobile number.
 */
export function normalizeBdPhone(input: string): string | null {
  const latin = toLatinDigits(input);
  const cleaned = latin.replace(/[\s\-().]/g, "");
  const m = cleaned.match(/^(?:\+?880|0)?(1[3-9]\d{8})$/);
  return m ? `${PHONE_COUNTRY_CODE}${m[1]}` : null;
}

/** +8801712345678 -> 01712345678 (what people dial and recognise locally). */
export function formatLocalPhone(e164: string): string {
  return e164.startsWith(PHONE_COUNTRY_CODE) ? `0${e164.slice(PHONE_COUNTRY_CODE.length)}` : e164;
}
