// Central app settings. Change values here, not deep inside components.
export const APP_NAME = "Rokto";
export const APP_NAME_BN = "রক্ত";

/** The people/orgs behind the site, credited in the footer as "Powered by A & B ...".
 *  Give a url to link that name; leave it null for plain text.
 *  logo: a path under /public. When set, the footer shows the logo instead of the name -
 *  these marks already carry their own wordmark, so printing the name too would duplicate it. */
export interface OrgCredit {
  name: string;
  url: string | null;
  logo?: string;
}
export const ORGS: OrgCredit[] = [
  { name: "Sadhanananda International Buddhist Monastery", url: "https://www.sibmusa.org/", logo: "/orgs/sibm.png" },
  { name: "Nandan", url: "https://www.facebook.com/nandans.official", logo: "/orgs/nandan.png" },
  { name: "Green Education", url: "https://www.facebook.com/profile.php?id=100092444718761", logo: "/orgs/green-education.png" },
];

/** The starting team, copied into Firestore the first time /team or the admin Team tab loads.
 *  After that, manage people from /admin -> Team; editing this list changes nothing. */
export const DEFAULT_TEAM = [
  {
    name: "Wasiful Karim Wasif",
    role: "Founder & Developer",
    section: "founding",
    photo: "/team/wasif.jpg",
    email: "",
    facebook: "",
  },
  {
    name: "Khokon Barua",
    role: "Founder & Developer",
    section: "founding",
    photo: "/team/khokon.jpg",
    email: "",
    facebook: "",
  },
  {
    name: "Khokon Barua",
    role: "Operations & Support",
    section: "operations",
    photo: "/team/khokon.jpg",
    email: "baruakhokon01@gmail.com",
    facebook: "https://www.facebook.com/khokon.barua.737",
  },
] as const;

/** Blood banks and hospitals Rokto works with, shown on the homepage as a moving strip.
 *  EMPTY ON PURPOSE: the section does not render until a partnership is actually agreed.
 *  Add one like the ORGS above - name, optional url, optional logo under /public/partners/ -
 *  and only when the partnership actually exists. A name here is a public claim about them. */
export const PARTNERS: OrgCredit[] = [];

/** Donors who gave blood within this many days are listed below ready donors.
 *  PENDING OWNER + MEDICAL DECISION #7 (L3): one interval for everyone today. */
export const DONATION_COOLDOWN_DAYS = 90;

/** Bangladesh time. "Today", the SMS daily cap and date pickers all use this, not UTC (F11, D6). */
export const APP_TIME_ZONE = "Asia/Dhaka";

/** Where data / abuse requests go. PENDING OWNER: replace with a role mailbox (L1, L4). */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@roktoctg.com";

/** Seconds before the OTP "resend" button becomes active. */
export const OTP_RESEND_SECONDS = 30;

/** Most donors one search can return (sorted best-first BEFORE this cut, see F5).
 *  The list renders SEARCH_PAGE_SIZE at a time with "Show more". */
export const SEARCH_LIMIT = 500;
export const SEARCH_PAGE_SIZE = 30;

/** How long the server keeps the public directory cached (S4: Firestore reads scale with this,
 *  not with visitors). Any donor write clears it immediately. */
export const SEARCH_CACHE_SECONDS = 300;

/**
 * PENDING OWNER DECISION #1 (audit section 8): how phone numbers are shown.
 *   "tap"    - (recommended) search never returns phones; each "Show number" tap asks the server for
 *              one number, behind CAPTCHA + rate limits, so the directory can't be scraped in bulk.
 *   "public" - search returns phones directly (old behaviour, still never in bulk from the browser).
 */
export const PHONE_REVEAL_MODE: "tap" | "public" = "tap";
/** After one CAPTCHA, further reveals from the same visitor ride on a short signed pass. */
export const REVEAL_PASS_TTL_SECONDS = 15 * 60;
/** Per-IP ceilings. Deliberately not tiny: mobile carriers here put thousands of real people
 *  behind one address, so a hard per-IP cap punishes the wrong person. The per-ACCOUNT limits
 *  below are the real defence - an account costs an SMS to make, an IP costs nothing. */
export const REVEAL_MAX_PER_IP_PER_HOUR = 25;
export const REVEAL_MAX_PER_IP_PER_DAY = 60;
/** Per-account limits. Enough for a real emergency - ring ten people in an hour - and far short of
 *  taking the directory home. */
export const REVEAL_MAX_PER_ACCOUNT_PER_HOUR = 10;
export const REVEAL_MAX_PER_ACCOUNT_PER_DAY = 25;
/** One look-up of one donor, for this long. A refresh, a second tap or a back-and-forward is the
 *  same look-up and must not become a second row in the donor's history. */
export const REVEAL_DEDUP_SECONDS = 15 * 60;
/** How long a reveal record is kept. /privacy states this number; change both together. */
export const REVEAL_RETENTION_DAYS = 365;

/** PENDING OWNER DECISION #5: public location precision. Locations are snapped to this grid
 *  (same home -> same public point, every time; S5). */
export const LOCATION_GRID_METERS = 500;

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
export const OTP_MAX_PER_IP_PER_DAY = 20; // S3
export const OTP_MAX_PER_SUBNET_PER_DAY = 60; // S3: one /24 (IPv4) or /48 (IPv6)
export const OTP_DEFAULT_DAILY_CAP = 300; // overall texts/day; override with OTP_DAILY_CAP (0 = stop all)
/** Share of the daily cap kept for /recover so registration spam can't starve it (and vice versa). */
export const OTP_RECOVER_SHARE = 0.3;
/** Share kept for account sign-in. Without its own slice, a rush of people looking for blood -
 *  or one person cycling numbers - would eat the budget and leave a real donor unable to register. */
export const OTP_SIGNIN_SHARE = 0.25;
/** Wrong codes allowed per phone per day, across resends (S13). */
export const OTP_MAX_FAILED_PER_PHONE_PER_DAY = 15;
/** A recover proof may be retried this many times (idempotent retry, S11), never more. */
export const PROOF_MAX_USES = 3;

/** Account accounts: people looking for blood. A account is NOT a donor and NOT an admin - the
 *  account exists so that every phone number taken out of the directory has a name behind it.
 *  Long-lived on purpose: an emergency is the worst moment to be asked to verify a phone again. */
export const ACCOUNT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
/** Tries before giving up on finding a free username (collisions are vanishingly rare). */
export const ACCOUNT_USERNAME_TRIES = 8;

/** Username sign-in: failed guesses allowed per IP per window. A username is a lookup key, so the
 *  guess rate is what stands between it and enumeration. */
export const ACCOUNT_LOGIN_MAX_FAILS = 10;
export const ACCOUNT_LOGIN_WINDOW_SECONDS = 900;
/** Username changes per account per day (stops name-squatting churn). */
export const ACCOUNT_RENAMES_PER_DAY = 5;

/** How long an admin login session lasts before needing the password again (S7). */
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

/** Minimum length for a per-person admin password (set by `npm run admin:add`). */
export const ADMIN_MIN_PASSWORD_LENGTH = 12;

/** Brute-force guard on /api/admin/login (per IP). */
export const ADMIN_LOGIN_MAX_ATTEMPTS = 8;
export const ADMIN_LOGIN_WINDOW_SECONDS = 900; // 15 minutes

/** PENDING OWNER DECISION #4 (F10): donors may correct their own name and blood group from the
 *  edit page (blood group behind a confirm step). false = re-register with the same number instead. */
export const ALLOW_PROFILE_CORRECTIONS = true;

/** Abuse reports (L2): per-IP limits on the public "Report this listing" form. */
export const REPORT_MAX_PER_IP_PER_DAY = 10;
export const REPORT_REASONS = ["wrong_number", "not_registered", "harassment", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Admin donor list page size (H7). */
export const ADMIN_PAGE_SIZE = 50;
