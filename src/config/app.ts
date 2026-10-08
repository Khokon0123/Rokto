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
