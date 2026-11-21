// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/register/page";
import { fakeFetch, renderEn } from "../support/render";

vi.mock("@/components/LocationField", () => ({ default: () => null }));
// /register is one page for two jobs now. These tests are about the DONOR path, so they arrive the
// way the "Register as a donor" card sends people: with the listing box already ticked.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/register",
  useSearchParams: () => new URLSearchParams("donor=1"),
}));
afterEach(() => vi.unstubAllGlobals());

describe("F9: a failed save keeps the verified phone", () => {
  it("retrying after a failure sends exactly one SMS", async () => {
    let saves = 0;
    const { fn, calls } = fakeFetch({
      "POST /api/otp/send": () => [200, { challengeId: "c1" }],
      "POST /api/otp/verify": () => [200, { proof: "proof-1" }],
      "POST /api/donors": () => (++saves === 1 ? [500, { error: "server_error" }] : [200, { editToken: "x".repeat(43), existing: false }]),
    });
    vi.stubGlobal("fetch", fn);
    renderEn(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Rahim Uddin" } });
    fireEvent.change(screen.getByLabelText(/^Phone number/), { target: { value: "01712345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // step 2: blood group is a row of chips
    fireEvent.click(await screen.findByRole("button", { name: "O+" }));
    const area = document.getElementById("register-area") as HTMLInputElement;
    fireEvent.change(area, { target: { value: "Kotwali" } });
    fireEvent.click(await screen.findByRole("option", { name: /Kotwali/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // step 3: consent
    fireEvent.click(await waitFor(() => document.getElementById("consent")!));
    fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));

    const code = await screen.findByLabelText("6-digit code");
    fireEvent.change(code, { target: { value: "১২৩৪৫৬" } }); // Bengali digits work (E1)
    expect(code).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    await screen.findByText(/couldn't save your profile yet/);
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    await screen.findByText("You're registered");
    expect(calls.filter((c) => c.key === "POST /api/otp/send")).toHaveLength(1);
    expect(calls.filter((c) => c.key === "POST /api/donors").map((c) => (c.body as { proof: string }).proof)).toEqual(["proof-1", "proof-1"]);
    expect((calls.find((c) => c.key === "POST /api/otp/send")!.body as { purpose: string }).purpose).toBe("register");
  });

  it("Next on step 2 without a blood group stops there and says so", async () => {
    vi.stubGlobal("fetch", fakeFetch({}).fn);
    renderEn(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Rahim Uddin" } });
    fireEvent.change(screen.getByLabelText(/^Phone number/), { target: { value: "01712345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    expect(await screen.findByText("Choose your blood group.")).toBeTruthy();
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
  });

  it("an invalid form moves focus to the first problem (A1)", async () => {
    vi.stubGlobal("fetch", fakeFetch({}).fn);
    renderEn(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(document.activeElement?.id).toBe("name"));
    expect(screen.getByLabelText(/^Name/)).toHaveAttribute("aria-invalid", "true");
  });
});

describe("one page, two jobs", () => {
  it("unticking the donor box leaves only a phone number to fill in", async () => {
    const { fn, calls } = fakeFetch({
      "POST /api/otp/send": () => [200, { challengeId: "c1" }],
      "POST /api/otp/verify": () => [200, { proof: "p", username: "shanto-alo-472", created: true }],
    });
    vi.stubGlobal("fetch", fn);
    renderEn(<RegisterPage />);

    fireEvent.click(screen.getByRole("button", { name: "I only need a username, not a donor listing" }));
    // Someone who only wants to find blood is not asked for their blood group, area or consent.
    expect(screen.queryByLabelText(/^Name/)).toBeNull();
    expect(screen.queryByLabelText(/^Blood group/)).toBeNull();
    expect(document.getElementById("consent")).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Phone number/), { target: { value: "01712345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));
    fireEvent.change(await screen.findByLabelText("6-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));

    // The username comes back with the code check, and no donor listing is written.
    expect(await screen.findByText("shanto-alo-472")).toBeTruthy();
    expect(calls.some((c) => c.key.startsWith("POST /api/donors"))).toBe(false);
    // Its SMS comes out of the sign-in budget, not the one protecting donor registration.
    const send = calls.find((c) => c.key === "POST /api/otp/send");
    expect((send?.body as { purpose?: string })?.purpose).toBe("signin");
  });
});
