# Rokto (রক্ত)

Find available blood donors in Chittagong by blood group and area. Search is public (no login).
Donors register with a one-time SMS code and manage their profile through a private edit link.

Stack: Next.js (App Router, TypeScript), Tailwind CSS, Firebase Firestore, SMS OTP via BulkSMSBD, Vercel.

## Setup

1. **Firebase project** (console.firebase.google.com) - the free Spark plan is enough; no card needed.
   - Add a **Web app** and copy its config into `.env.local` (see `.env.example`).
   - **Firestore Database**: create in production mode, then publish `firestore.rules`
     (`npx firebase-tools deploy --only firestore:rules`, or paste the file into the Rules tab).
   - **Project settings > Service accounts > Generate new private key**; put project id, client email and private key in `.env.local`.
   - Firebase phone sign-in is NOT used (it needs a paid plan and costs about $0.20 per SMS to Bangladesh).
2. `cp .env.example .env.local`, fill it in, set `OTP_SECRET` (`openssl rand -base64 48`), then `npm install && npm run dev`.
   With `SMS_PROVIDER=console` the verification code is printed in the terminal running `npm run dev`.
3. **Real SMS (production)**: create a BulkSMSBD account, buy a small non-masking pack, then set
   `SMS_PROVIDER=bulksmsbd`, `BULKSMSBD_API_KEY`, `BULKSMSBD_SENDER_ID`.
4. **Vercel**: add the same variables under Project Settings > Environment Variables.
5. Optional: add free Cloudflare Turnstile keys to block bots from the SMS endpoint.

## How the security works

- `donors/{id}`: public read (search), **no client writes**. Phone numbers are shown by design in v1.
- `donorSecrets/{id}`: SHA-256 hash of the edit token. Never readable or writable from a browser.
- `otpChallenges`, `rateLimits`: private server-only bookkeeping (hashed codes, counters).
- All writes go through `/api/*` routes using the Admin SDK.
- Phone check: `/api/otp/send` texts a 6-digit code (valid 5 min, 5 wrong guesses max, only an HMAC of it is stored).
  `/api/otp/verify` returns a signed 10-minute proof. Register, recover and phone change require that proof;
  the phone number comes from the proof, never from the request.
- Every SMS costs money, so sending is limited: 30s between codes per number, 5/hour per number,
  10/hour per IP, 300/day overall (`OTP_DAILY_CAP`), plus optional Turnstile.
- Editing requires the private token. Edit links are shown once. Lost link = re-verify at `/recover`,
  which issues a new link and invalidates the old one.

## Future (intentionally not built in v1)

Accounts/passwords, admin moderation, push/SMS request alerts, hospital/blood-bank integration,
GPS radius search, request/accept flow, village-level areas, Bengali translation (copy is in `src/i18n`),
server-side search endpoint (swap the body of `src/lib/search.ts`).
