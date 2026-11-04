// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchClient from "@/components/SearchClient";
import { deferred, fakeFetch, renderEn } from "../support/render";

vi.mock("@/components/DonorMap", () => ({ default: () => null }));
afterEach(() => vi.unstubAllGlobals());

const donor = (id: string, bloodGroup: string) => ({ id, name: `Donor ${id}`, bloodGroup, area: "kotwali", lastDonated: null, location: null, phone: "" });

describe("F1: stale results while a new search loads", () => {
  it("old results are dimmed and their Call buttons can't be used", async () => {
    const second = deferred<[number, unknown]>();
    let n = 0;
    const { fn } = fakeFetch({
      "GET /api/search": () => (++n === 1 ? [200, { donors: [donor("a1", "A+")], total: 1, truncated: false }] : second.promise),
    });
    vi.stubGlobal("fetch", fn);
    renderEn(<SearchClient />);
    const call = await screen.findByRole("button", { name: "Show phone number" });
    expect(call).not.toBeDisabled();

    // The blood group is a row of chips now, not a select: changing the filter is a tap.
    fireEvent.click(screen.getByRole("button", { name: "O-" }));
    await waitFor(() => expect(screen.getByText("Updating results for your new filters...")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Show phone number" })).toBeDisabled();
    expect(screen.queryByText("1 donor")).toBeNull(); // the old count is gone

    await act(async () => second.resolve([200, { donors: [donor("o1", "O-")], total: 1, truncated: false }]));
    await waitFor(() => expect(screen.getByText("Donor o1")).toBeInTheDocument());
    expect(screen.queryByText("Donor a1")).toBeNull();
    expect(screen.getByRole("button", { name: "Show phone number" })).not.toBeDisabled();
  });

  it("shows a truncation note and pages with Show more (F5)", async () => {
    const many = Array.from({ length: 45 }, (_, i) => donor(`d${i}`, "B+"));
    vi.stubGlobal("fetch", fakeFetch({ "GET /api/search": () => [200, { donors: many, total: 600, truncated: true }] }).fn);
    renderEn(<SearchClient />);
    await screen.findByText(/Showing the best 45 matches/);
    expect(screen.getAllByRole("button", { name: "Show phone number" })).toHaveLength(30);
    fireEvent.click(screen.getByRole("button", { name: "Show more donors" }));
    expect(screen.getAllByRole("button", { name: "Show phone number" })).toHaveLength(45);
  });
});
