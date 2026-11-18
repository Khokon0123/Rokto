# Rokto security check — 18 Nov 2026

Read-only check by three agents. No files were changed except this one. Nothing was deployed.
Compared against the fixes claimed in `AUDIT_REPORT.md`.

## Verdict
No Critical or High findings. The claimed fixes for S2, S3, S7, S8, S10, S11, S12, S13, D1–D4 and L2 are implemented correctly in code.
**Not proven by tests:** the emulator tests (Firestore rules, transactions, rate limits) and Playwright e2e did not run because this machine has no Java. Install a JDK (`brew install openjdk`) and run `npm run test:emulator`.

## Automated checks
| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `vitest` (unit + component) | Pass, 81/81 |
| `npm audit --omit=dev` | **1 low**: `fast-xml-parser` 5.11.1 (GHSA-474x-hrwr-fgx4), via `firebase-admin` → `@google-cloud/storage`. `npm audit fix` is offered. |
| Emulator tests (8 files) | **Not run** (no Java) |
| Playwright e2e | **Not run** (needs the emulator) |

## Working (verified in code)
- Firestore rules deny all client access; TTL policies and indexes present.
- CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy set; `/edit` is no-store and no-referrer; `/admin` is noindex.
- Admin session: dedicated HMAC secret, bound to the password hash and a version, 12 h expiry, timing-safe compares, httpOnly, strict SameSite, secure in production. Login limited to 8 per 15 min per IP.
- Per-person admin logins use scrypt with salt and constant-time compare.
- Client IP never trusts X-Forwarded-For.
- `readJson` (JSON type, 8 KB cap, Origin check) is used by every mutating route. All admin routes call `requireAdmin`.
- Turnstile fails closed in production; hostname and action are checked.
- OTP: transactional cooldown and counters, single-use codes, signed purpose-bound proofs with one-time claim.
- Edit tokens are 256-bit, stored as a hash, and checked inside the mutation transaction.
- Phone uniqueness via `phoneIndex`; blocked phones are rejected at send, register and change.
- Phones are not returned by `/api/search`; only `POST /api/donors/:id/contact` returns them (signed-in account, rate limits, captcha or pass, audit row).
- No injection, SSRF or `dangerouslySetInnerHTML` found; CSV export is formula-safe.
- Secrets: nothing sensitive ever committed; `.env.local` is gitignored (mode 600); CI uses no secrets and has no injection risks; `public/` and `scripts/` clean.

## Issues to fix
### Medium
1. **Open redirect** — `src/app/register/RegisterClient.tsx:35-37` (`safeNext`). `/\evil.com` passes the check because browsers treat `/\` as `//`. Needs a click. Fix: `/^\/(?![\/\\])/.test(raw)`.
2. **Disabled admin keeps access up to 12 h** — `src/lib/server/adminAuth.ts:59-77`. Disabling a user in `adminUsers` doesn't revoke their cookie. Fix: re-read the `adminUsers` doc in `requireAdmin`, or add a per-user session version.

### Low
3. **Shared IP bucket off Vercel** — `rateLimit.ts:73-74`, `api/admin/login/route.ts:10`. Without `TRUSTED_IP_HEADER` outside Vercel, all visitors share one `"unknown"` bucket, so anyone can lock out admin login and OTP for everyone. Fix: make `env.ts` require `VERCEL` or `TRUSTED_IP_HEADER` in production; also fix `subnetOf` for compressed IPv6.
4. **`.env.example` incomplete** — missing `ACCOUNT_SESSION_SECRET` and `ACCOUNT_SESSION_VERSION`. Production requires the secret, so a fresh deploy from the template fails on startup.
5. **Blocklist oracle** — `otp.ts:116-117`. `assertNotBlocked` reads Firestore before captcha and rate limits, revealing whether a number is blocked. Fix: run captcha and the IP limit first.
6. **Suspended accounts can still use `/api/search`** — `api/search/route.ts:12`. No phones are exposed, only names, areas and blood groups.
7. **Wrong-code cap is not atomic** — `otp.ts:203-227`. Parallel guesses can overshoot 15, but the real ceiling (5 attempts × 5 sends/hour) isn't exploitable. Fix: increment inside the verify transaction.
8. **No `Strict-Transport-Security` header** — set `max-age=63072000; includeSubDomains` for the custom domain.
9. **`script-src 'unsafe-inline'`** in the CSP weakens XSS protection. Acceptable trade-off for now; use a nonce-based CSP later.
10. **`/account` not in `robots.ts` disallow** and has no noindex header.
11. **Old `NEXT_PUBLIC_FIREBASE_*` values** still in `.env.local`, unused by the code. Delete them.
12. **Dependency**: `npm audit fix` for the low `fast-xml-parser` finding.

### Minor / info
- `/api/edit` and `/api/otp/verify` have no per-IP limit (safe because of the 256-bit token and per-phone cap, but each call costs a Firestore read).
- Reveal pass is bound to the IP only, not the account.
- Account cookie lasts 30 days; no `__Host-` cookie prefix.
- `/api/health` shows which subsystems are misconfigured.
- A staging build with `NODE_ENV !== "production"` turns off captcha, the Origin-required rule and the trusted-IP rule. Run staging with `NODE_ENV=production`.
- `ci.yml` has no `permissions: contents: read`.
- `scripts/migrate.ts` and `add-admin.ts` have no production confirmation prompt.
- `_to_delete/` and `.next-stale-claude/` should be deleted from the working tree.
