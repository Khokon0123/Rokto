import { describe, expect, it } from "vitest";
import { isFacebookUrl, isServedPhoto, validateTeamMember } from "@/lib/team";

describe("team validation", () => {
  const base = { name: "Khokon Barua", role: "Developer", section: "founding", photo: "", email: "", facebook: "" };
  it("accepts a valid member and keeps served photos as 'unchanged'", () => {
    expect(validateTeamMember(base)).toHaveProperty("fields");
    expect(validateTeamMember({ ...base, photo: "/api/team/abc123/photo?v=0a1b2c" })).toHaveProperty("fields");
    expect(isServedPhoto("/api/team/abc/photo?v=12")).toBe(true);
    expect(isServedPhoto("/api/team/../photo")).toBe(false);
  });
  it("rejects bad fields", () => {
    expect(validateTeamMember({ ...base, name: "x" })).toEqual({ error: "team_name_invalid" });
    expect(validateTeamMember({ ...base, section: "board" })).toEqual({ error: "bad_request" });
    expect(validateTeamMember({ ...base, email: "nope" })).toEqual({ error: "team_email_invalid" });
    expect(validateTeamMember({ ...base, photo: "https://evil.example/x.png" })).toEqual({ error: "team_photo_invalid" });
    expect(isFacebookUrl("https://facebook.com.evil.example/x")).toBe(false);
    expect(isFacebookUrl("https://www.facebook.com/x")).toBe(true);
  });
});
