import assert from "node:assert/strict";
import { test } from "node:test";
import { getGmailAccessErrorMessage } from "../lib/errors";

test("disabled Gmail API is distinguished from missing OAuth consent in both Google error formats", () => {
  for (const error of [
    { errors: [{ reason: "accessNotConfigured" }] },
    { details: [{ reason: "SERVICE_DISABLED" }] },
  ]) {
    assert.match(getGmailAccessErrorMessage(403, { error }), /Gmail API nincs engedélyezve/);
  }
  for (const error of [
    { errors: [{ reason: "insufficientPermissions" }] },
    { details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] },
  ]) {
    assert.match(getGmailAccessErrorMessage(403, { error }), /Gmail összekapcsolása/);
  }
});

test("quota and transient failures do not instruct users to change permissions", () => {
  assert.match(getGmailAccessErrorMessage(403, { error: { errors: [{ reason: "userRateLimitExceeded" }] } }), /kerete/);
  assert.match(getGmailAccessErrorMessage(429, null), /kerete/);
  assert.match(getGmailAccessErrorMessage(503, null), /átmenetileg/);
});

test("revoked credentials and domain policies give distinct recovery instructions", () => {
  assert.match(getGmailAccessErrorMessage(401, null), /Csatlakoztasd újra/);
  assert.match(getGmailAccessErrorMessage(403, { error: { errors: [{ reason: "domainPolicy" }] } }), /rendszergazd/);
});

test("malformed and unknown Google errors never expose raw messages or metadata", () => {
  for (const body of [null, "private-token", { error: null }, { error: {
    message: "private-token", errors: [null, "private-token", { reason: "private-token" }],
    details: { reason: "SERVICE_DISABLED", metadata: { token: "private-token" } },
  } }]) {
    const message = getGmailAccessErrorMessage(403, body);
    assert.match(message, /HTTP 403/);
    assert.doesNotMatch(message, /private-token/);
  }
});
