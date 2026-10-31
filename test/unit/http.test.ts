import { afterEach, describe, expect, it, vi } from "vitest";
import { readJson } from "@/lib/server/http";

afterEach(() => vi.unstubAllEnvs());

const post = (body: string, headers: Record<string, string>) =>
  new Request("https://www.roktoctg.com/api/x", { method: "POST", body, headers });

describe("S10: request hygiene", () => {
  it("accepts a same-origin JSON body", async () => {
    await expect(readJson(post('{"a":1}', { "content-type": "application/json", origin: "https://www.roktoctg.com" }))).resolves.toEqual({ a: 1 });
  });
  it("rejects text/plain", async () => {
    await expect(readJson(post('{"a":1}', { "content-type": "text/plain", origin: "https://www.roktoctg.com" }))).rejects.toMatchObject({ status: 415 });
  });
  it("rejects a foreign Origin", async () => {
    await expect(readJson(post('{"a":1}', { "content-type": "application/json", origin: "https://evil.example" }))).rejects.toMatchObject({ status: 403 });
  });
  it("rejects a 1 MB body even without Content-Length", async () => {
    const big = JSON.stringify({ a: "x".repeat(1024 * 1024) });
    await expect(readJson(post(big, { "content-type": "application/json", origin: "https://www.roktoctg.com" }))).rejects.toMatchObject({ status: 413 });
  });
  it("in production a missing Origin is rejected", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(readJson(post("{}", { "content-type": "application/json" }))).rejects.toMatchObject({ status: 403 });
  });
  it("rejects arrays and junk", async () => {
    await expect(readJson(post("[1]", { "content-type": "application/json", origin: "https://www.roktoctg.com" }))).rejects.toMatchObject({ status: 400 });
  });
});
