"use client";

import { apiCall } from "./api";
import { solveCaptcha } from "./turnstile";

// S2 "tap to reveal": the first reveal solves one (usually invisible) CAPTCHA; the server answers
// with a short-lived pass, kept only in memory, so further reveals in the same visit are instant.
let pass: string | null = null;

/** Where Turnstile draws its (rarely visible) challenge for reveals and reports. */
export function captchaHost(): HTMLElement {
  let el = document.getElementById("rokto-captcha-host");
  if (!el) {
    el = document.createElement("div");
    el.id = "rokto-captcha-host";
    el.className = "fixed inset-x-0 bottom-4 z-[2000] flex justify-center";
    document.body.appendChild(el);
  }
  return el;
}

export async function revealDonorPhone(donorId: string): Promise<{ phone?: string; error?: string }> {
  const tryOnce = async (withCaptcha: boolean) => {
    let captcha: string | null = null;
    if (withCaptcha) captcha = await solveCaptcha(captchaHost(), "reveal");
    return apiCall<{ phone: string; pass: string }>(`/api/donors/${encodeURIComponent(donorId)}/contact`, "POST", {
      pass,
      captcha,
    });
  };
  try {
    // With a pass, skip the CAPTCHA; if the pass expired the server asks for one (captcha_failed).
    let res = await tryOnce(!pass);
    if (!res.ok && pass && res.error === "captcha_failed") {
      pass = null;
      res = await tryOnce(true);
    }
    if (!res.ok || !res.data) return { error: res.error ?? "generic" };
    pass = res.data.pass;
    return { phone: res.data.phone };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "captcha_failed" };
  }
}
