# Rokto remediation report

Work against `ROKTO_FULL_AUDIT_AND_FIX_GUIDE.md` (audit of 30 Oct 2026). Every finding was checked
against the code before changing it; all 53 still applied.

## Environment
- Branch `audit-fixes` on top of `ab6f7b7` (4 commits; the first one only saves the owner's uncommitted Bangla/English copy edits). Date: 31 Oct 2026.
- Node 22.23.4, npm 10.9.9.
- Next 16.4.3, firebase-admin 14.5.0. The browser `firebase` SDK is no longer a runtime dependency (dev-only, for the rules tests).

## Issue status

Abbreviations: **U** unit test (`test/unit`), **C** component test (`test/components`), **EM** emulator test (`test/emulator`), **E2E** Playwright (`test/e2e`).

| ID | Status | Proof / notes |
|----|----|----|
| S1 | fixed | next 16.4.3, firebase-admin 14.5.0, client `firebase` removed from runtime, overrides for `uuid` (gaxios) and `glob` (rimraf). `npm audit --omit=dev`: **0 vulnerabilities**. `engines.node >=22`, `@types/node` 22. |
| S2 | fixed (proper fix) | Rules deny every client read/write (EM `rules.test.ts`: unfiltered list, list with `available==true`, `limit(500)`, get-by-id, all private collections, writes: all denied). Search is `GET /api/search` from a server-side cache with no phones; numbers via `POST /api/donors/:id/contact` (Turnstile once, then a 15-min IP-bound pass, 40/h + 120/day per IP). E2E covers reveal. `consentAt`/`updatedAt` remain on the donor doc, which is no longer public. |
| S3 | fixed | Turnstile mandatory in production (U); order CAPTCHA → IP hour → IP day → /24 subnet day → daily budget → cooldown + per-phone **inside the challenge transaction** (EM: an IP-limited request leaves the victim phone's counter untouched). Recovery has its own 30% budget. Alerts at 50/80/100% of a budget (`ALERT_WEBHOOK_URL`). Counters refunded when the gateway refuses. |
| S4 | fixed | Search reads a 4-document pre-built `directory` once per 5 min and after writes: reads no longer scale with visitors or donors (EM: directory follows every write). Load estimate in README. Map reuses the same cache. |
| S5 | fixed | Deterministic ~500 m grid snapping (U: 100 saves → 1 point, cells ≥ 400 m apart; EM: repeated saves identical). Migration snaps existing points. |
| S6 | fixed | New links are `/edit#<token>`; old `/edit/<token>` links rewrite themselves to the fragment (E2E asserts the format; full journey uses it). "Only send this to yourself" copy added. |
| S7 | fixed | `ADMIN_SESSION_SECRET`, signature bound to a hash of the password + `ADMIN_SESSION_VERSION`; 12 h TTL; `sameSite: strict`, same attributes on logout; `adminAudit` entries for login, delete, block, export, team changes, report dismissals. U: session rejected after password change / version bump. |
| S8 | fixed | IP from `x-real-ip` on Vercel or `TRUSTED_IP_HEADER`; X-Forwarded-For never trusted; unknown = one shared bucket. U: forged XFF doesn't change the key. |
| S9 | fixed | CSP (+`frame-ancestors 'none'`), `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy, `poweredByHeader: false`. Enforced in production (checked with `next start`: all pages, map tiles, no CSP errors), report-only in dev (hot reload needs it) or with `CSP_REPORT_ONLY=1`. E2E checks headers. |
| S10 | fixed | `readJson`: JSON content type, 8 KB cap (400 KB for team photos) enforced while streaming, Origin must match. U: text/plain 415, foreign Origin 403, 1 MB 413, missing Origin in prod 403. |
| S11 | fixed | Proofs carry `purpose` + `jti`; `usedProofs` (TTL) records use inside the mutation transaction; same purpose + subject retry allowed up to 3 times. U + EM. |
| S12 | fixed | Hostname + action checked, network/5xx → `503 captcha_unavailable`, prod config pairing checked at startup, 30 s client timeout. U. |
| S13 | fixed | 15 wrong codes per phone per Dhaka day, across resends. EM. |
| D1 | fixed | `phoneIndex/{sha256}` read/written in every register / phone change / delete transaction. EM: 20 concurrent registrations → 1 donor; two donors racing for one number → exactly one; registration racing a phone change → no duplicate. |
| D2 | fixed | Recovery = index → donor → phone match → secret, one transaction. EM: recovery racing delete never leaves a token for a deleted profile. |
| D3 | fixed | Token hash checked inside the same transaction as edit/delete. EM: old token fails after recovery. |
| D4 | fixed | Random `challengeId`, cooldown + creation in one transaction, failure deletes only its own challenge, verify requires the id. EM: parallel sends → 1 SMS; "A fails after B succeeded" keeps B. |
| D5 | fixed | `expireAt` Timestamps on `rateLimits`, `otpChallenges`, `usedProofs`; TTL policies in `firestore.indexes.json` (needs Blaze; deploy with `firebase deploy --only firestore:indexes`). Migration backfills. |
| D6 | fixed | Daily cap keyed by Asia/Dhaka date; `OTP_DAILY_CAP=0` stops all SMS; `SMS_DISABLED=true` kill switch. U + EM. |
| D7 | fixed | Seeding is an admin action ("Add the starting team"); `/team` cached 5 min and refreshed on every admin change; order assigned in a transaction; `404 not_found`; outage shows "team unavailable" instead of stale defaults. Note: a brand-new database shows an empty team page until an admin presses the seed button. |
| M1 | fixed | Strict pure parser. U: "Unsuccessful", "Balance: 1000 BDT", HTTP 500 + "success", empty, malformed JSON, `10000` all rejected. |
| M2 | fixed | Exact checks + HTTP 2xx for Alpha/BulkSMSBD. U. |
| M3 | fixed | WebOTP line `@<domain> #<code>`; optional Bangla text (`SMS_BANGLA=true`, off by default because Unicode SMS cost more). U. |
| F1 | fixed | Stale results dimmed, Call buttons disabled, count replaced by "Updating…", `aria-busy`. C (delayed mock). |
| F2 | fixed | Map loading overlay, error card with retry, stale pins hidden. |
| F3 | fixed | `FitBounds` child refits on a stable key. |
| F4 | fixed | Donors at one point share one marker whose popup lists them all (with Call buttons). Chose grouping over adding a clustering library. |
| F5 | fixed | Server sorts before the 500 cut; list shows 30 at a time with "Show more"; "Showing the best N matches" note when cut. U + C. |
| F6 | fixed | Only `404 link_invalid` offers recovery; network/5xx/timeout show Retry; 15 s client timeout. C. |
| F7 | fixed | Saves serialised, only the newest response updates the screen, failures re-read the server. C (out-of-order responses). |
| F8 | fixed | Date draft saved on blur or "Save date" only. C. |
| F9 | fixed | Proof kept; "Couldn't save → Try saving again" reuses it (server accepts the retry). C: one `/api/otp/send` call across failure + retry. |
| F10 | fixed (pending owner #4) | Name and blood group editable (blood group behind a confirm) behind `ALLOW_PROFILE_CORRECTIONS`; homepage copy updated. |
| F11 | fixed | All "today" logic in Asia/Dhaka. U (01:30 Dhaka). |
| F12 | fixed | Bilingual `not-found`, `error`, `global-error`; dev-only "add Firebase settings" message removed; dead `searched` state and unused strings removed; admin errors clear on success; `beforeunload` warning after registration; white fill for transparent PNGs. |
| E1 | fixed | Shared `toLatinDigits`; OTP box and server accept ০-৯. C + EM. |
| E2 | fixed (spellings for owner review) | `labelBn` + aliases for all 31 areas, accent/space-insensitive matching, labels by locale everywhere. U. |
| E3 | fixed | `document.documentElement.lang` updated + `router.refresh()`. E2E. |
| E4 | fixed | Badge label translated; per-page titles/descriptions in the visitor's language (`generateMetadata`); SMS (M3). |
| A1 | fixed | `aria-invalid`, `aria-describedby`, `aria-required`, focus moves to the first invalid field, alerts announced (register, recover, OTP, area). C. |
| A2 | fixed | Arrow/Home/End tabs with roving tabindex and wired tabpanels (team page, admin). |
| A3 | fixed | `motion-safe:` variants; smooth scroll only without reduced motion. |
| L1 | fixed (text pending owner #8) | `/privacy` and `/terms` in both languages, linked from the footer and the consent box, consent text lists everything public, contact email (`NEXT_PUBLIC_CONTACT_EMAIL`). Clearly marked draft with `[OWNER: ...]` placeholders. |
| L2 | fixed | "Report this listing" (reason + note, Turnstile, 10/day per IP), admin Reports tab, delete-and-block, `blockedPhones` checked by OTP send, register and phone change. EM: blocked number can't re-register. |
| L3 | partially (pending owner #7) | Disclaimer that Rokto only connects people and recipients must go through a hospital/blood bank; "Who can donate" section with a placeholder. No medical text was invented. |
| L4 | pending owner | Needs written permissions (partner logos, team photos). `config/app.ts` still has a personal Gmail and Facebook link in the starting team; replace with a role mailbox if wanted. |
| L5 | fixed | `/admin` and `/edit` in robots, sitemap, manifest, per-page metadata, `NEXT_PUBLIC_SITE_URL`. |
| H1 | fixed | Vitest unit + component, emulator rules/concurrency/migration tests, Playwright e2e, scripts, GitHub Actions gate (incl. `npm audit --audit-level=high`). Coverage of `src/lib` in the unit run: **90.1% statements** (Firestore-bound server modules are covered by the emulator suite instead). |
| H2 | fixed | `src/lib/server/env.ts` validates production config at server start (`instrumentation.ts`) and refuses to run; `GET /api/health`. U. Used plain checks instead of adding `zod`. |
| H3 | partially | Structured JSON logs (phones masked, no codes/tokens), alert webhook for budget and harassment reports, `/api/health` for uptime monitors. **Owner:** create a Sentry (or similar) project, an uptime monitor, SMS balance checks and Firebase budget alerts. |
| H4 | fixed (plan choice pending owner #3) | Admin "Back up all donors" JSON/CSV export (formula-safe CSV, audited), weekly routine + PITR/export instructions in README. |
| H5 | fixed | README and `.env.example` rewritten (all providers, required vars, rules/index/TTL deploy, emulator workflow, tests, deploy, rollback, backups, load). |
| H6 | fixed (one leftover) | `.gitignore` for local tool output, `engines`, `@types/node` 22, `server-only` dependency, unused template SVGs removed, history scanned for keys/env files (none). The `_to_delete` references in `tsconfig.json`/`eslint.config.mjs` stay until that 1.2 GB folder is deleted from the project folder. `gitleaks` itself was not run (not installed); a pattern scan of all history was. |
| H7 | fixed | Cursor pagination (50), server-side group/area filters, exact phone lookup via `phoneIndex`, composite indexes in `firestore.indexes.json`. |
| H8 | fixed | Browser Firebase SDK removed; team photos served from `/api/team/:id/photo` (cached, content-hashed URL) instead of inlined base64; marker icons memoised; OSM tile URL without `{s}`. |

## Verification (real output, this machine)

- `npm audit --omit=dev`: `found 0 vulnerabilities`
- `npm run lint`: exit 0, no warnings
- `npm run typecheck`: exit 0
- `npm run test:coverage`: `Test Files 10 passed (10)`, `Tests 76 passed (76)`; Statements 90.14%, Branches 83.59%, Functions 88.6%, Lines 90.14%
- `npm run test:emulator`: `donors.test.ts (11)`, `otp.test.ts (7)`, `migrate.test.ts (1)`, `rules.test.ts (6)`: `Tests 25 passed (25)`
- `npm run build`: exit 0
- `npm run test:e2e`: `4 passed` (full donor journey, Bangla toggle, admin, headers)
- Extra: production build served with `next start` and complete dummy config: every page 200 (404 page for unknown routes), map tiles load, no CSP or console errors besides the expected 404s.

Not verified here: a real Firebase project, a real SMS gateway, a real Turnstile widget, a low-end Android phone. Those are in the owner checklist.

## Migrations
- `scripts/migrate.ts` (+ `scripts/migrate-lib.ts`): idempotent, `--dry-run`, builds `phoneIndex` and `directory`, snaps locations, backfills `expireAt`. Duplicate phones / conflicting index entries are **reported and skipped**, never merged. Emulator test: dry run writes nothing; second run changes nothing.
- Run it once after deploying (README step 5). **Search shows nobody until it has run**, because search now reads the pre-built `directory`.

## Config / ops changes the owner must do
- New env vars: `NEXT_PUBLIC_SITE_URL`, `ADMIN_SESSION_SECRET`, `ADMIN_SESSION_VERSION`, `NEXT_PUBLIC_CONTACT_EMAIL`, `ALERT_WEBHOOK_URL`, `TRUSTED_IP_HEADER` (only off Vercel), `SMS_DISABLED`, `SMS_BANGLA`, `CSP_REPORT_ONLY`, `BULKSMSDHAKA_*` (now documented). `ADMIN_PASSWORD` must be 16+ characters. Turnstile keys are now required. The `NEXT_PUBLIC_FIREBASE_*` variables are no longer used.
- Firebase: deploy rules + indexes (`npx firebase-tools deploy --only firestore:rules,firestore:indexes`), Blaze + budget alert, PITR or scheduled exports, run the migration.
- Preview deployments: separate Firebase project, `SMS_PROVIDER=console`.
- Monitoring: Sentry (or similar), uptime monitor on `/` and `/api/health`, SMS balance, Firebase usage alerts.

## Pending owner decisions (recommended option implemented, in `src/config/app.ts`)
1. Phone numbers: `PHONE_REVEAL_MODE = "tap"` (reveal per tap). `"public"` returns them with search results instead.
2. Unavailable donors: hidden completely (never in the directory).
3. Firebase plan: Blaze recommended (TTL, PITR); the code works on Spark, TTL then needs a manual cleanup.
4. Name / blood-group corrections: allowed (`ALLOW_PROFILE_CORRECTIONS = true`).
5. Location precision: `LOCATION_GRID_METERS = 500`.
6. Admin model: shared password with the S7 fixes; per-person accounts not built.
7. Eligibility and medical wording: placeholder; `DONATION_COOLDOWN_DAYS = 90` unchanged.
8. Privacy/terms legal review: drafts with placeholders.
9. Primary SMS provider + fallback: all three kept and hardened; pick one.

## Known remaining risks
- `/team` shows nothing on a brand-new database until an admin seeds it (existing databases already have `meta/team.seeded`).
- Area Bangla spellings and the privacy/terms drafts need a native-speaker / legal read.
- CSP still allows `'unsafe-inline'` scripts (needed by Next.js without nonces); nonce-based CSP would be stricter.
- Each `directory` shard holds about 8,000 donors; raise `DIRECTORY_SHARDS` and re-run the migration well before 30,000 donors.
