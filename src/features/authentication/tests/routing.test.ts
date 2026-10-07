import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { authConfig } from "../lib/auth.config";

const authorized = authConfig.callbacks?.authorized;
assert.ok(authorized);

const requestFor = (pathname: string) =>
  new NextRequest(`https://homebase.test${pathname}`);

const assertRedirect = (result: unknown, pathname: string) => {
  assert.ok(result instanceof Response);
  assert.equal(result.status, 307);
  assert.equal(new URL(result.headers.get("location") ?? "").pathname, pathname);
};

test("the public root is available to guests and authenticated users", async (t) => {
  await t.test("guest", async () => {
    assert.equal(await authorized({ auth: null, request: requestFor("/") }), true);
  });

  await t.test("authenticated user", async () => {
    assert.equal(
      await authorized({ auth: { user: { id: "user-1" } } as never, request: requestFor("/") }),
      true,
    );
  });
});

test("app routes redirect guests and auth objects without a user", async (t) => {
  await t.test("app root", async () => {
    assertRedirect(
      await authorized({ auth: null, request: requestFor("/app") }),
      "/login",
    );
  });

  await t.test("nested app route", async () => {
    assertRedirect(
      await authorized({ auth: null, request: requestFor("/app/monthly-expenses") }),
      "/login",
    );
  });

  await t.test("auth without a user", async () => {
    assertRedirect(
      await authorized({ auth: {} as never, request: requestFor("/app/settings") }),
      "/login",
    );
  });
});

test("authenticated users visiting login are redirected to the app", async () => {
  assertRedirect(
    await authorized({ auth: { user: { id: "user-1" } } as never, request: requestFor("/login") }),
    "/app",
  );
});

test("a path sharing the app prefix is not protected", async (t) => {
  await t.test("guest", async () => {
    assert.equal(await authorized({ auth: null, request: requestFor("/application") }), true);
  });

  await t.test("authenticated user", async () => {
    assert.equal(
      await authorized({ auth: { user: { id: "user-1" } } as never, request: requestFor("/application") }),
      true,
    );
  });
});
