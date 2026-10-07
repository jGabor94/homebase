import assert from "node:assert/strict";
import { test } from "node:test";
import { hasStoredGmailConnection } from "../utils/gmail-connection";
import { isGmailReconnectRequired } from "../lib/errors";

test("saved Gmail consent survives token expiry only when it can be refreshed", () => {
  const now = 1_800_000_000_000;
  const account = { scope: "openid email https://www.googleapis.com/auth/gmail.readonly", hasRefreshToken: true, hasAccessToken: true, expiresAt: 1 };
  assert.equal(hasStoredGmailConnection(account, now), true);
  assert.equal(hasStoredGmailConnection({ ...account, hasRefreshToken: false }, now), false);
  assert.equal(hasStoredGmailConnection({ ...account, hasRefreshToken: false, expiresAt: now / 1000 + 3600 }, now), true);
  assert.equal(hasStoredGmailConnection({ ...account, scope: "openid email profile" }, now), false);
  assert.equal(hasStoredGmailConnection({ ...account, scope: "https://www.googleapis.com/auth/gmail.readonly.other" }, now), false);
  assert.equal(hasStoredGmailConnection(null, now), false);
});

test("reconnection is offered for missing consent and revoked access, not service or quota failures", () => {
  assert.equal(isGmailReconnectRequired(401, null), true);
  assert.equal(isGmailReconnectRequired(403, { error: { errors: [{ reason: "insufficientPermissions" }] } }), true);
  assert.equal(isGmailReconnectRequired(403, { error: { details: [{ reason: "ACCESS_TOKEN_SCOPE_INSUFFICIENT" }] } }), true);
  for (const status of [429, 500, 503]) assert.equal(isGmailReconnectRequired(status, null), false);
  assert.equal(isGmailReconnectRequired(403, { error: { details: [{ reason: "SERVICE_DISABLED" }] } }), false);
});
