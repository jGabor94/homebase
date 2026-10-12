import assert from "node:assert/strict";
import { test } from "node:test";
import type { Session } from "next-auth";
import { hasPermission } from "@/features/authorization/utils";

const user = (roles: unknown): Session["user"] => ({
  id: "test-user", username: "test", name: "Test", image: "", email: "family@example.test", roles,
} as Session["user"]);

test("only the explicit notesMember role grants note permissions", () => {
  for (const action of ["read", "create", "update", "delete"] as const) {
    assert.equal(hasPermission(user(["notesMember"]), "notes", action), true);
    assert.equal(hasPermission(user(["user"]), "notes", action), false);
    assert.equal(hasPermission(user(["admin"]), "notes", action), false);
    assert.equal(hasPermission(user(null), "notes", action), false);
  }
});
