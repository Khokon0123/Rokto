// Central app settings. Change values here, not deep inside components.
export const APP_NAME = "Rokto";
export const APP_NAME_BN = "রক্ত";

/** The organization behind the site. Set ORG_URL to link the footer credit (null = plain text). */
export const ORG_NAME = "Nandan";
export const ORG_URL: string | null = null;

/** Donors who gave blood within this many days are listed below ready donors. */
export const DONATION_COOLDOWN_DAYS = 90;

/** Seconds before the OTP "resend" button becomes active. */
export const OTP_RESEND_SECONDS = 30;

/** Max donors fetched per search in v1 (future: pagination / "load more"). */
export const SEARCH_LIMIT = 200;

/** v1 accepts Bangladeshi mobile numbers only (cuts SMS-pumping abuse). */
export const PHONE_COUNTRY_CODE = "+880";

/** How long a texted code stays valid, and how many wrong guesses are allowed per code. */
export const OTP_TTL_SECONDS = 300;
export const OTP_MAX_ATTEMPTS = 5;

/** After a correct code, the signed proof of phone ownership is accepted for this long. */
export const OTP_PROOF_TTL_SECONDS = 600;

/** Anti-abuse: every text costs real money, so sending is throttled hard. */
export const OTP_RESEND_COOLDOWN_SECONDS = 30; // min gap between codes to one number
export const OTP_MAX_PER_PHONE_PER_HOUR = 5;
export const OTP_MAX_PER_IP_PER_HOUR = 10;
export const OTP_DEFAULT_DAILY_CAP = 300; // overall texts/day; override with OTP_DAILY_CAP

/** How long an admin login session lasts before needing the password again. */
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Brute-force guard on /api/admin/login (per IP). */
export const ADMIN_LOGIN_MAX_ATTEMPTS = 8;
export const ADMIN_LOGIN_WINDOW_SECONDS = 900; // 15 minutes
