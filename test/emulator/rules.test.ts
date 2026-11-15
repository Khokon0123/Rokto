import { readFileSync } from "node:fs";
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, describe, it } from "vitest";

// S2: no browser can read or write anything, so the directory can't be scraped from the client SDK.
let env: RulesTestEnvironment;
beforeAll(async () => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-rokto",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "donors/d1"), { name: "A", phone: "+8801712345678", available: true, bloodGroup: "O+" });
  });
});
afterAll(() => env?.cleanup());

describe("firestore.rules", () => {
  const db = () => env.unauthenticatedContext().firestore();
  it("denies an unfiltered list of donors", () => assertFails(getDocs(collection(db(), "donors"))));
  it("denies a list even with available == true", () =>
    assertFails(getDocs(query(collection(db(), "donors"), where("available", "==", true), limit(10)))));
  it("denies limit(500)", () => assertFails(getDocs(query(collection(db(), "donors"), limit(500)))));
  it("denies a get by id", () => assertFails(getDoc(doc(db(), "donors/d1"))));
  it("denies every private collection", async () => {
    for (const c of ["donorSecrets", "phoneIndex", "otpChallenges", "rateLimits", "usedProofs", "reports", "adminAudit", "adminUsers", "team", "blockedPhones", "accounts", "accountPhones", "usernames", "reveals", "revealDedup"]) {
      await assertFails(getDoc(doc(db(), `${c}/x`)));
    }
  });
  it("denies writes", () => assertFails(setDoc(doc(db(), "donors/new"), { name: "x" })));
});
