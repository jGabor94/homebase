import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { hasPermission } from "@/features/authorization/utils";
import { isBootstrapAdminEmail } from "@/features/authentication/utils";

const user = (roles: unknown): Session["user"] => ({
  id: "test-user", username: "test", name: "Test", image: "", email: "family@example.test", roles,
} as Session["user"]);

test("monthly imports require the configured admin role", () => {
  assert.equal(hasPermission(user(["user"]), "monthlyExpenses", "import"), false);
  assert.equal(hasPermission(user(["admin"]), "monthlyExpenses", "import"), true);
  assert.equal(hasPermission(user([]), "monthlyExpenses", "read"), false);
});

test("missing or unknown role claims do not grant access or crash", () => {
  assert.equal(hasPermission(user(null), "monthlyExpenses", "import"), false);
  assert.equal(hasPermission(user(["invented-admin"]), "monthlyExpenses", "import"), false);
});

test("bootstrap email comparison is normalized and never grants an absent configuration", () => {
  const previous = process.env.BOOTSTRAP_ADMIN_EMAIL;
  try {
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    assert.equal(isBootstrapAdminEmail(undefined), false);
    assert.equal(isBootstrapAdminEmail("family@example.test"), false);
    process.env.BOOTSTRAP_ADMIN_EMAIL = " Family@Example.Test ";
    assert.equal(isBootstrapAdminEmail("family@example.test"), true);
    assert.equal(isBootstrapAdminEmail("other@example.test"), false);
  } finally {
    if (previous === undefined) delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    else process.env.BOOTSTRAP_ADMIN_EMAIL = previous;
  }
});
