"use client";

// Cloudflare Turnstile (free CAPTCHA). Required in production; when NEXT_PUBLIC_TURNSTILE_SITE_KEY
// isn't set (local development) solveCaptcha resolves null and the server skips the check.
interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
/** S12: if the widget never calls back, give up so the button doesn't say "Sending..." forever. */
export const CAPTCHA_TIMEOUT_MS = 30_000;
let scriptLoaded: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptLoaded ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoaded = null;
      reject(new Error("captcha_unavailable"));
    };
    document.head.appendChild(s);
  });
  return scriptLoaded;
}

/**
 * Returns a one-time token for `action`, or null when Turnstile isn't configured.
 * Rejects with Error("captcha_failed" | "captcha_unavailable" | "captcha_timeout").
 */
export async function solveCaptcha(container: HTMLElement | null, action: string): Promise<string | null> {
  if (!SITE_KEY || !container) return null;
  await loadScript();
  const api = window.turnstile;
  if (!api) throw new Error("captcha_unavailable");
  return new Promise<string>((resolve, reject) => {
    const el = document.createElement("div");
    container.replaceChildren(el);
    let id = "";
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (id) api.remove(id);
      fn();
    };
    const timer = setTimeout(() => done(() => reject(new Error("captcha_timeout"))), CAPTCHA_TIMEOUT_MS);
    id = api.render(el, {
      sitekey: SITE_KEY,
      action, // checked by the server (S12): a token for one form can't be replayed on another
      appearance: "interaction-only", // invisible unless Cloudflare needs a human check
      callback: (token: string) => done(() => resolve(token)),
      "error-callback": () => done(() => reject(new Error("captcha_failed"))),
      "timeout-callback": () => done(() => reject(new Error("captcha_timeout"))),
    });
  });
}
