import { describe, expect, it } from "vitest";

// Simulate security validation logic for Honeypot & Nonce
function simulateFormSubmission(data: {
  honeypot?: string;
  nonce?: string;
  validSessionNonce?: string;
}) {
  // 1. Check Honeypot
  if (data.honeypot && data.honeypot.length > 0) {
    return { status: "BLOCKED", reason: "Honeypot triggered (Bot detected)" };
  }

  // 2. Check Nonce
  if (!data.nonce || data.nonce !== data.validSessionNonce) {
    return { status: "BLOCKED", reason: "Invalid or missing session nonce (Bot/Script detected)" };
  }

  return { status: "SUCCESS", reason: "Legitimate user submission passed successfully" };
}

describe("Security Bot Protection Simulation", () => {
  const activeNonce = "nonce_abc123xyz789";

  it("allows legitimate user submission with correct nonce and empty honeypot", () => {
    const result = simulateFormSubmission({
      honeypot: "",
      nonce: activeNonce,
      validSessionNonce: activeNonce,
    });
    expect(result.status).toBe("SUCCESS");
  });

  it("blocks bot trying to fill the hidden honeypot field", () => {
    const result = simulateFormSubmission({
      honeypot: "http://spam-link.com",
      nonce: activeNonce,
      validSessionNonce: activeNonce,
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).toContain("Honeypot");
  });

  it("blocks automated script trying to submit without session nonce", () => {
    const result = simulateFormSubmission({
      honeypot: "",
      nonce: undefined,
      validSessionNonce: activeNonce,
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).toContain("nonce");
  });

  it("blocks script trying to forge an incorrect nonce", () => {
    const result = simulateFormSubmission({
      honeypot: "",
      nonce: "fake_nonce_999",
      validSessionNonce: activeNonce,
    });
    expect(result.status).toBe("BLOCKED");
    expect(result.reason).toContain("nonce");
  });
});
