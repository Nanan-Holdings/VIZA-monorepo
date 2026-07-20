import assert from "node:assert/strict";
import test from "node:test";
import { classifyVnPrearrivalEmailVerificationText } from "../email-verification";

test("accepts Vietnam Pre-Arrival OTP state when official processing has started", () => {
  assert.equal(
    classifyVnPrearrivalEmailVerificationText(
      "Submission Processing Progress - Finalizing your declaration",
    ),
    "accepted",
  );
  assert.equal(
    classifyVnPrearrivalEmailVerificationText("Your submission is successful!"),
    "accepted",
  );
});

test("classifies explicit invalid or expired OTP responses as rejected", () => {
  assert.equal(
    classifyVnPrearrivalEmailVerificationText("Incorrect verification code. Try again."),
    "rejected",
  );
  assert.equal(
    classifyVnPrearrivalEmailVerificationText("This verification code has expired."),
    "rejected",
  );
});

test("keeps an open verification dialog pending while the portal is still checking", () => {
  assert.equal(
    classifyVnPrearrivalEmailVerificationText(
      "Verify your email. We have sent a 6-digit code to your email.",
    ),
    "pending",
  );
});
