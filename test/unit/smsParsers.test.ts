import { describe, expect, it } from "vitest";
import { otpMessage, parseAlpha, parseBulkSmsBd, parseBulkSmsDhaka } from "@/lib/server/smsParsers";

describe("M1: Bulk SMS Dhaka parser", () => {
  it.each([
    ["Unsuccessful", 200],
    ["not success", 200],
    ['{"success": false}', 200],
    ["Balance: 1000 BDT", 200],
    ["error 1000", 200],
    ["success", 500],
    ["1000", 500],
    ["", 200],
    ["{not json", 200],
    ['{"Status":"1005"}', 200],
    ['{"Status":"10000"}', 200],
    ['{"message":"1000"}', 200],
  ])("rejects %j (HTTP %i)", (raw, status) => {
    expect(parseBulkSmsDhaka(status, raw).accepted).toBe(false);
  });

  it.each([["1000"], [" 1000 \n"], ['{"Status":"1000"}'], ['{"status":1000}'], ['{"code":"1000","msg":"ok"}']])(
    "accepts %j",
    (raw) => expect(parseBulkSmsDhaka(200, raw).accepted).toBe(true),
  );
});

describe("M2: Alpha and BulkSMSBD parsers", () => {
  it.each(['{"error":""}', '{"error":null}', '{"error":false}', "{}", '{"error":"1"}', "oops"])("Alpha rejects %s", (raw) => {
    expect(parseAlpha(200, raw).accepted).toBe(false);
  });
  it("Alpha accepts error 0 / \"0\" only with HTTP 2xx", () => {
    expect(parseAlpha(200, '{"error":0}').accepted).toBe(true);
    expect(parseAlpha(200, '{"error":"0"}').accepted).toBe(true);
    expect(parseAlpha(502, '{"error":0}').accepted).toBe(false);
  });
  it("BulkSMSBD accepts response_code 202 only", () => {
    expect(parseBulkSmsBd(200, '{"response_code":202}').accepted).toBe(true);
    expect(parseBulkSmsBd(200, '{"response_code":"202"}').accepted).toBe(true);
    expect(parseBulkSmsBd(200, '{"response_code":1007}').accepted).toBe(false);
    expect(parseBulkSmsBd(500, '{"response_code":202}').accepted).toBe(false);
    expect(parseBulkSmsBd(200, "202").accepted).toBe(false);
  });
});

describe("M3: SMS text", () => {
  it("ends with the WebOTP binding line for our domain", () => {
    const msg = otpMessage({ appName: "Rokto", code: "123456", ttlMinutes: 5, domain: "www.roktoctg.com", bangla: false });
    expect(msg.split("\n").at(-1)).toBe("@www.roktoctg.com #123456");
  });
  it("has a Bangla version", () => {
    expect(otpMessage({ appName: "Rokto", code: "123456", ttlMinutes: 5, domain: null, bangla: true })).toContain("কোড 123456");
  });
});
