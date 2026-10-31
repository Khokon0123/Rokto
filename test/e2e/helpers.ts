import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { OUTBOX } from "../../playwright.config";

export function resetOutbox() {
  mkdirSync(path.dirname(OUTBOX), { recursive: true });
  writeFileSync(OUTBOX, "");
}

export async function lastCode(phoneE164: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    if (existsSync(OUTBOX)) {
      const lines = readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean);
      const hit = lines.map((l) => JSON.parse(l) as { phone: string; code: string }).reverse().find((m) => m.phone === phoneE164);
      if (hit) return hit.code;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no SMS for ${phoneE164}`);
}

export async function wipeEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  await fetch(`http://${host}/emulator/v1/projects/demo-rokto/databases/(default)/documents`, { method: "DELETE" });
}


export async function verify(page: Page, phoneE164: string) {
  const code = await lastCode(phoneE164);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
}
