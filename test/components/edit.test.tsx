// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditClient, { tokenTransport } from "@/app/edit/EditClient";
import { deferred, fakeFetch, renderEn } from "../support/render";

vi.mock("@/components/LocationField", () => ({ default: () => null }));
afterEach(() => vi.unstubAllGlobals());

const profile = (over: Record<string, unknown> = {}) => ({
  name: "Rahim",
  phone: "+8801712345678",
  bloodGroup: "O+",
  area: "kotwali",
  available: true,
  lastDonated: null,
  location: null,
  ...over,
});

describe("F6: outages are not 'invalid link'", () => {
  it("a 500 shows Retry, not the recover button", async () => {
    vi.stubGlobal("fetch", fakeFetch({ "POST /api/edit": () => [500, { error: "server_error" }] }).fn);
    renderEn(<EditClient transport={tokenTransport("t")} />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Verify your phone to get a new link.")).toBeNull();
  });
  it("only a 404 link_invalid offers recovery", async () => {
    vi.stubGlobal("fetch", fakeFetch({ "POST /api/edit": () => [404, { error: "link_invalid" }] }).fn);
    renderEn(<EditClient transport={tokenTransport("t")} />);
    expect(await screen.findByText("Verify your phone to get a new link.")).toBeInTheDocument();
  });
});

describe("F7: rapid changes", () => {
  it("out-of-order responses end with the screen matching the server", async () => {
    const first = deferred<[number, unknown]>();
    let patches = 0;
    vi.stubGlobal(
      "fetch",
      fakeFetch({
        "POST /api/edit": () => [200, { profile: profile() }],
        "PATCH /api/edit": (body) => {
          patches++;
          const b = body as { available: boolean };
          return patches === 1 ? first.promise : [200, { profile: profile({ available: b.available }) }];
        },
      }).fn,
    );
    renderEn(<EditClient transport={tokenTransport("t")} />);
    const toggle = await screen.findByRole("switch");
    fireEvent.click(toggle); // -> false (slow)
    fireEvent.click(toggle); // -> true (queued behind it)
    await act(async () => first.resolve([200, { profile: profile({ available: false }) }]));
    await waitFor(() => expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true"));
    expect(patches).toBe(2);
  });
});

describe("F8: date field", () => {
  it("does not save while typing; saves once on Save date", async () => {
    const { fn, calls } = fakeFetch({
      "POST /api/edit": () => [200, { profile: profile() }],
      "PATCH /api/edit": () => [200, { profile: profile({ lastDonated: "2026-01-02" }) }],
    });
    vi.stubGlobal("fetch", fn);
    renderEn(<EditClient transport={tokenTransport("t")} />);
    const input = await screen.findByLabelText("Last donated");
    fireEvent.change(input, { target: { value: "0002-01-02" } });
    fireEvent.change(input, { target: { value: "2026-01-02" } });
    expect(calls.filter((c) => c.key === "PATCH /api/edit")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save date" }));
    await waitFor(() => expect(calls.filter((c) => c.key === "PATCH /api/edit")).toHaveLength(1));
  });
});
