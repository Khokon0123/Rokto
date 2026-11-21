// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/register/page";
import { fakeFetch, renderEn } from "../support/render";

vi.mock("@/components/LocationField", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/register",
  useSearchParams: () => new URLSearchParams(),
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
