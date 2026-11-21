import { expect, test } from "@playwright/test";
import { resetOutbox, verify, wipeEmulator } from "./helpers";

test.beforeEach(async ({ context }) => {
  await wipeEmulator();
  resetOutbox();
  await context.addCookies([{ name: "rokto_locale", value: "en", url: "http://localhost:3210" }]);
});

test("register -> edit link -> edit -> search -> recover (old link dies) -> delete", async ({ page }) => {
  const phone = "+8801712345678";

  // Register. ?donor=1 is how the homepage's "Register as a donor" card arrives: the listing box
  // is already ticked, so the donor fields are on screen.
  await page.goto("/register?donor=1");
  await page.getByLabel(/^Name/).fill("Rahim Uddin");
  await page.getByLabel(/^Phone number/).fill("01712345678");
  await page.getByLabel(/^Blood group/).selectOption("O-");
  await page.locator("#register-area").fill("Kotw");
  await page.getByRole("option", { name: /Kotwali/ }).click();
  await page.locator("#consent").check(); // two checkboxes now: list-me-as-a-donor, and consent
  await page.getByRole("button", { name: "Send verification code" }).click();
  await verify(page, phone);
  await expect(page.getByText("You're registered")).toBeVisible();

  // S6: the link carries the token in the #fragment
  const link = await page.getByRole("textbox", { name: "Save your private edit link" }).inputValue();
  expect(link).toMatch(/\/edit#[A-Za-z0-9_-]{43}$/);

  // Edit through the link: switch availability off and back on
  page.on("dialog", (d) => d.accept());
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Your donor profile" })).toBeVisible();
  const toggle = page.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // No sign-in step here: registering as a donor already opened an account and set the session
  // (one code does both), so this journey arrives at the search signed in.

  // Search finds the donor; the number is revealed on a tap (S2)
  // The blood group filter is a row of chips now, not a select: one tap, not open-scroll-confirm.
  await page.getByRole("button", { name: "O-", exact: true }).click();
  await expect(page.getByText("Rahim Uddin")).toBeVisible();
  await page.getByRole("button", { name: "Show phone number" }).click();
  await expect(page.getByRole("link", { name: "Call 01712345678" })).toBeVisible();

  // Turning availability off hides the donor from search at once
  await page.goto(link);
  await page.getByRole("switch").click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.goto("/search");
  // The blood group filter is a row of chips now, not a select: one tap, not open-scroll-confirm.
  await page.getByRole("button", { name: "O-", exact: true }).click();
  await expect(page.getByText("No available donors found.")).toBeVisible();

  // Recover: new link works, old link is dead
  resetOutbox(); // so the next code read is the recovery SMS, not the registration one
  await page.goto("/recover");
  await page.getByLabel("Phone number").fill("01712345678");
  await page.getByRole("button", { name: "Send verification code" }).click();
  await verify(page, phone);
  const fresh = await page.getByRole("textbox", { name: "Save your private edit link" }).inputValue();
  expect(fresh).not.toBe(link);
  await page.goto("/");
  await page.goto(link);
  await expect(page.getByText("This link isn't valid. It may have been replaced by a newer one.")).toBeVisible();

  // Delete with the new link
  await page.goto("/");
  await page.goto(fresh);
  await page.getByRole("button", { name: "Delete my profile" }).click();
  await page.getByRole("button", { name: "Yes, delete it" }).click();
  await expect(page.getByText("Your profile was deleted.")).toBeVisible();
});

test("Bangla toggle updates <html lang> (E3)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Switch to Bangla" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});

test("admin: login, see donors, log out", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill("e2e-admin-password-123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Admin panel" })).toBeVisible();
  await page.getByRole("tab", { name: "Reports" }).click();
  await expect(page.getByText("No open reports.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("security headers are set (S9)", async ({ request }) => {
  const res = await request.get("/");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["content-security-policy-report-only"] ?? res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});

test("signed out, searching asks for a username; no username -> register", async ({ page }) => {
  // The gate is on the page, so a typed URL hits it too. No phone field here any more.
  await page.goto("/search?group=O-");
  await expect(page).toHaveURL(/\/search\?group=O-/);
  await expect(page.getByLabel("Your username")).toBeVisible();
  await expect(page.getByLabel(/^Phone number/)).toHaveCount(0);

  // Unknown username is refused.
  await page.getByLabel("Your username").fill("nobody-here-0000");
  await page.getByRole("button", { name: "Find donors" }).click();
  await expect(page.getByText("No account has that username.")).toBeVisible();

  // No username yet -> register, which still carries the search.
  await page.getByRole("link", { name: /Get a username/ }).click();
  // The full register form (donor fields on screen), carrying the search to return to.
  await expect(page).toHaveURL(/\/register\?donor=1&next=.*group%3DO-/);
  await expect(page.getByLabel(/^Name/)).toBeVisible();
  await expect(page.getByLabel(/^Blood group/)).toBeVisible();
});

test("the issued username signs you back in, and can be changed", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(/^Phone number/).fill("01912345678");
  await page.getByRole("button", { name: "Send verification code" }).click();
  await verify(page, "+8801912345678");
  const issued = (await page.getByText(/^[a-z]+-[a-z]+-\d{4}$/).textContent())!.trim();

  // Change it on the account page.
  await page.goto("/account");
  await page.getByLabel("Change username").fill("my-e2e-name");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Username changed.")).toBeVisible();

  // Sign out, then back in by username (the old one is gone, the new one works).
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/search");
  await page.getByLabel("Your username").fill(issued);
  await page.getByRole("button", { name: "Find donors" }).click();
  await expect(page.getByText("No account has that username.")).toBeVisible();
  await page.getByLabel("Your username").fill("my-e2e-name");
  await page.getByRole("button", { name: "Find donors" }).click();
  await expect(page.getByRole("button", { name: "O-", exact: true })).toBeVisible();
});
