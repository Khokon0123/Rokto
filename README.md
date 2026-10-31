# Rokto (রক্ত)

Find available blood donors in Chittagong by blood group and area. Search is public (no login).
Donors register with a one-time SMS code and manage their profile through a private edit link.
Bangla is the default language; English is one tap away.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Firebase Firestore (server-side only),
SMS OTP through a Bangladeshi gateway, Cloudflare Turnstile, Vercel.

## How it works

| Flow | |
|---|---|
| Search `/search` | `GET /api/search` answers from a cached, pre-built list of **available** donors (no phone numbers). The browser never talks to Firestore. A visitor taps **Show phone number** on one donor; `/api/donors/:id/contact` returns that one number behind Turnstile and per-IP limits. |
| Register `/register` | Form, then SMS code (`/api/otp/send`, `/api/otp/verify`, purpose `register`), then `POST /api/donors`. Returns a one-time private edit link `/edit#<token>` (the token is in the `#fragment`, which is never sent to any server). |
| Edit `/edit#<token>` | Availability, last-donated date, area, location, name/blood group corrections, phone (needs a new code), delete. Old `/edit/<token>` links still work. |
| Recover `/recover` | SMS code (purpose `recover`), then a new edit token. The old link stops working. |
| Report | "Report this listing" on each donor card goes to the admin panel's **Reports** tab. |
| Admin `/admin` | One shared password, 12-hour session. Donors (paged, filters, exact phone lookup, delete, delete-and-block), Reports, Team, and a JSON/CSV backup download. |

### Data (all collections are private; `firestore.rules` denies every browser read and write)

`donors`, `directory` (search list, updated in the same transaction as every donor write),
`donorSecrets` (SHA-256 of edit tokens), `phoneIndex` (one profile per phone, enforced in transactions),
`blockedPhones`, `otpChallenges`, `usedProofs`, `rateLimits`, `reports`, `adminAudit`, `team`, `meta`.

### Security in short

- Every write goes through `/api/*` with the Admin SDK, after checking an OTP proof, an edit token or the admin session, **inside the same transaction as the change**.
- OTP codes are stored only as an HMAC, tied to a random challenge id and a purpose, 5 wrong guesses per code and 15 per phone per day.
- A proof is accepted only by the endpoint it was made for; repeating it is only allowed as a retry of the same action (max 3).
- SMS sending order: Turnstile, per-IP hourly/daily, per-subnet daily, the daily budget (Bangladesh time; separate share for recovery), then cooldown + per-phone limit atomically with the new challenge.
- Locations are snapped to a ~500 m grid on the server (the same home always gives the same point).
- Security headers on every page (CSP, `X-Frame-Options: DENY`, nosniff, Permissions-Policy); JSON-only, same-origin, size-capped API bodies.

## Local development

Needs Node 22+ and Java 21 (for the Firestore emulator).

```bash
npm install
cp .env.example .env.local      # fill in what you need; SMS_PROVIDER=console prints codes in the terminal
npm run dev
```

To develop without touching any real Firebase project, run the emulator and point the app at it:

```bash
npx firebase emulators:start --only firestore --project demo-rokto
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_ADMIN_PROJECT_ID=demo-rokto npm run dev
```

## Tests

| Command | What it runs |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint, `tsc --noEmit` |
| `npm test` (`npm run test:coverage`) | Unit + component tests (Vitest, jsdom) |
| `npm run test:emulator` | Firestore rules, concurrency (one profile per phone, token rotation, OTP challenges) and migration tests against the emulator |
| `npm run test:e2e` | Playwright: register → OTP → edit → search → recover → delete, admin, language toggle, headers. Uses the emulator and console SMS. First time: `npx playwright install chromium` |

GitHub Actions (`.github/workflows/ci.yml`) runs all of these plus `npm audit --omit=dev --audit-level=high`
on every push and pull request.

Never run tests against the live project and never set `FIRESTORE_EMULATOR_HOST` in production.

## Production setup

1. **Firebase project.** Use the **Blaze** plan with a budget alert (Google Cloud Console → Billing → Budgets). Blaze is needed for TTL policies and backups/PITR; Rokto's own usage stays far inside the free quota (see *Load* below).
   - Create Firestore in production mode.
   - Service accounts → Generate new private key → `FIREBASE_ADMIN_*` variables.
   - Deploy rules **and indexes/TTL**: `npx firebase-tools deploy --only firestore:rules,firestore:indexes`
     (`firestore.indexes.json` holds the admin-panel indexes and the TTL policies on `rateLimits`, `otpChallenges` and `usedProofs` via their `expireAt` field).
   - Turn on **Point-in-time recovery** (Firestore → Disaster recovery) and/or a scheduled export: `gcloud firestore export gs://<bucket>/rokto-$(date +%F)`.
2. **Cloudflare Turnstile**: create a widget for your production hostname. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is baked in at build time.
3. **SMS**: pick one provider (`bulksmsdhaka`, `alpha` or `bulksmsbd`), buy a small pack, set its key(s), send yourself a test code.
4. **Vercel**: set every variable from `.env.example` for Production. Use a **separate Firebase project and `SMS_PROVIDER=console`** (or a sandbox) for Preview deployments. Production refuses to start if anything required is missing or weak; `GET /api/health` shows which subsystems are configured (point an uptime monitor at it and at `/`).
5. **Migrate existing data** (once, after deploying this version):
   ```bash
   npx tsx --env-file=.env.local scripts/migrate.ts --dry-run   # report only
   npx tsx --env-file=.env.local scripts/migrate.ts             # apply (safe to re-run)
   ```
   It builds `phoneIndex` and `directory`, snaps stored locations, and adds `expireAt` fields. Duplicate phone numbers are **reported, not merged**: delete the extra profile in the admin panel, then run it again.
6. **Monitoring**: set `ALERT_WEBHOOK_URL` (Slack/Discord/Google Chat) for SMS budget (50/80/100%) and harassment-report alerts. Add error tracking (e.g. Sentry's free tier) and an SMS-balance check with your provider.

### Load (Firestore reads)

Search reads the 4 `directory` documents once per `SEARCH_CACHE_SECONDS` (300 s) and after each donor
write, whatever the number of visitors: about 4 × (288 + donor writes per day) reads/day. Each
"Show phone number" costs ~3 reads + 2 writes (rate limits + the donor), each SMS ~7 reads + 6 writes.
At 1,000 searches, 300 number reveals and 50 registrations a day that's roughly 3,000 reads and
1,000 writes, well under Spark's 50,000/20,000, and still under it at 10×.

### Backups (weekly, if PITR/exports aren't set up)

Admin panel → Donors → **Back up all donors** → Download JSON. Keep the files somewhere private.
To test a restore, load a file into the emulator with a short script that writes each donor back
(then run `scripts/migrate.ts` against the emulator to rebuild indexes).

### Rollback

- Code: Vercel → Deployments → previous deployment → **Promote to Production**.
- Rules: `git checkout <previous> -- firestore.rules && npx firebase-tools deploy --only firestore:rules`.
- Emergency stop for SMS: set `SMS_DISABLED=true` (or `OTP_DAILY_CAP=0`) and redeploy.
- Log every admin out: change `ADMIN_PASSWORD` or bump `ADMIN_SESSION_VERSION`.

## Decisions still with the owner

See `AUDIT_REPORT.md` → *Pending owner decisions*. The recommended option is implemented behind a constant in
`src/config/app.ts` (`PHONE_REVEAL_MODE`, `LOCATION_GRID_METERS`, `ALLOW_PROFILE_CORRECTIONS`, `DONATION_COOLDOWN_DAYS`).
`/privacy`, `/terms` and the homepage eligibility text contain `[OWNER: ...]` placeholders that must be completed
(with legal and medical review) before launch.
