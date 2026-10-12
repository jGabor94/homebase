import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { z } from "zod";

const manageMembership = async () => {
  const [action, emailInput, applyFlag, ...extra] = process.argv.slice(2);
  if ((action !== "grant" && action !== "revoke") || (applyFlag !== undefined && applyFlag !== "--apply") || extra.length) {
    throw new Error("usage");
  }
  const email = z.email().parse(emailInput?.trim().toLowerCase());
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("configuration");
  const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  try {
    const outcome = await client.begin(async (transaction) => {
      const users = await transaction<{ id: string; roles: string[] | null }[]>`
        SELECT id, roles FROM users WHERE lower(email) = ${email} FOR UPDATE
      `;
      if (users.length !== 1) throw new Error("unknown-user");
      const user = users[0];
      const alreadyMember = (user.roles ?? []).includes("notesMember");
      if (!applyFlag) return { applied: false, currentlyMember: alreadyMember, intendedMember: action === "grant" };
      if (action === "grant" && !alreadyMember) {
        await transaction`UPDATE users SET roles = array_append(COALESCE(roles, ARRAY[]::varchar[]), 'notesMember'), updated_at = now() WHERE id = ${user.id}`;
      } else if (action === "revoke" && alreadyMember) {
        await transaction`UPDATE users SET roles = array_remove(roles, 'notesMember'), updated_at = now() WHERE id = ${user.id}`;
      }
      return { applied: true, currentlyMember: action === "grant", changed: alreadyMember !== (action === "grant") };
    });
    console.log(JSON.stringify({ success: true, ...outcome }));
  } finally {
    await client.end();
  }
};

void manageMembership().catch(() => {
  console.error("A jegyzethozzáférés nem módosult. Használat: npx tsx src/features/notes/scripts/manage-membership.ts grant|revoke csaladtag@example.test [--apply]. Ellenőrizd az argumentumokat, a meglévő felhasználót és az adatbázis-kapcsolatot.");
  process.exitCode = 1;
});
