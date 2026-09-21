"use client";

// Optional Cloudflare Turnstile (free CAPTCHA). Only active when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
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
let scriptLoaded: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptLoaded ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptLoaded = null;
      reject(new Error("captcha script failed"));
    };
    document.head.appendChild(s);
  });
  return scriptLoaded;
}

/** Returns a one-time token, or null when Turnstile isn't configured. Rejects on failure/timeout. */
export async function solveCaptcha(container: HTMLElement | null): Promise<string | null> {
  if (!SITE_KEY || !container) return null;
  await loadScript();
  const api = window.turnstile;
  if (!api) throw new Error("captcha unavailable");
  return new Promise<string>((resolve, reject) => {
    const el = document.createElement("div");
    container.replaceChildren(el);
    let id = "";
    const done = (fn: () => void) => {
      if (id) api.remove(id);
      fn();
    };
    id = api.render(el, {
      sitekey: SITE_KEY,
      appearance: "interaction-only", // invisible unless Cloudflare needs a human check
      callback: (token: string) => done(() => resolve(token)),
      "error-callback": () => done(() => reject(new Error("captcha error"))),
      "timeout-callback": () => done(() => reject(new Error("captcha timeout"))),
    });
  });
}
