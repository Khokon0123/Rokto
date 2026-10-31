import "server-only";

// H2: production configuration is checked in one place, loudly, instead of failing late and
// quietly (a "healthy" site whose search, SMS or CAPTCHA is silently off).

export const isProduction = () => process.env.NODE_ENV === "production" && process.env.ROKTO_ALLOW_DEV_CONFIG !== "1";

export type Subsystem = "firebase" | "otp" | "sms" | "captcha" | "admin" | "site";

export interface ConfigIssue {
  subsystem: Subsystem;
  problem: string; // never contains a secret value
}

const env = (k: string) => (process.env[k] ?? "").trim();
const has = (k: string) => env(k).length > 0;

function smsIssues(): ConfigIssue[] {
  if (env("SMS_DISABLED") === "true") return [];
  const provider = env("SMS_PROVIDER") || "console";
  const need: Record<string, string[]> = {
    bulksmsbd: ["BULKSMSBD_API_KEY", "BULKSMSBD_SENDER_ID"],
    alpha: ["ALPHA_SMS_API_KEY"],
    bulksmsdhaka: ["BULKSMSDHAKA_API_KEY"],
  };
  if (provider === "console") return [{ subsystem: "sms", problem: "SMS_PROVIDER=console is not allowed in production" }];
  if (!need[provider]) return [{ subsystem: "sms", problem: `unknown SMS_PROVIDER "${provider}"` }];
  return need[provider].filter((k) => !has(k)).map((k) => ({ subsystem: "sms" as const, problem: `${k} is missing` }));
}

/** Every production misconfiguration we can detect without network calls. Empty = good. */
export function configIssues(): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const emulator = has("FIRESTORE_EMULATOR_HOST");
  for (const k of ["FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY"]) {
    if (!emulator && !has(k)) issues.push({ subsystem: "firebase", problem: `${k} is missing` });
  }
  if (env("OTP_SECRET").length < 32) issues.push({ subsystem: "otp", problem: "OTP_SECRET must be at least 32 characters" });
  if (env("ADMIN_PASSWORD").length < 16) issues.push({ subsystem: "admin", problem: "ADMIN_PASSWORD must be at least 16 characters" });
  if (env("ADMIN_SESSION_SECRET").length < 32) {
    issues.push({ subsystem: "admin", problem: "ADMIN_SESSION_SECRET must be at least 32 characters" });
  }
  if (env("ADMIN_SESSION_SECRET") && env("ADMIN_SESSION_SECRET") === env("OTP_SECRET")) {
    issues.push({ subsystem: "admin", problem: "ADMIN_SESSION_SECRET must differ from OTP_SECRET" });
  }
  if (!has("TURNSTILE_SECRET_KEY")) issues.push({ subsystem: "captcha", problem: "TURNSTILE_SECRET_KEY is missing" });
  if (!has("NEXT_PUBLIC_TURNSTILE_SITE_KEY")) {
    issues.push({ subsystem: "captcha", problem: "NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing (must be set at build time)" });
  }
  if (!has("NEXT_PUBLIC_SITE_URL")) issues.push({ subsystem: "site", problem: "NEXT_PUBLIC_SITE_URL is missing" });
  return [...issues, ...smsIssues()];
}

/** True when this subsystem has no detected problem. Outside production, everything counts as ready. */
export function subsystemReady(s: Subsystem): boolean {
  if (!isProduction()) return true;
  return !configIssues().some((i) => i.subsystem === s);
}

/** Fails fast at server start in production (called from instrumentation.ts). */
export function assertProductionConfig(): void {
  if (!isProduction()) return;
  const issues = configIssues();
  if (issues.length === 0) return;
  const list = issues.map((i) => `  - [${i.subsystem}] ${i.problem}`).join("\n");
  throw new Error(`Rokto production configuration is incomplete:\n${list}`);
}

/** The site's own origin(s), for Origin checks (S10) and Turnstile hostname checks (S12). */
export function allowedOrigins(): string[] {
  const list = [env("NEXT_PUBLIC_SITE_URL"), ...env("ALLOWED_ORIGINS").split(",")]
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => {
      try {
        return new URL(v).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  if (process.env.VERCEL_URL) list.push(`https://${process.env.VERCEL_URL}`);
  return [...new Set(list)];
}

export function allowedHostnames(): string[] {
  return allowedOrigins().map((o) => new URL(o).hostname);
}
