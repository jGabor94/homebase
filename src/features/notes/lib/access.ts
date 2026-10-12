import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { usersTable } from "@/features/user/drizzle/schema";
import { hasPermission } from "@/features/authorization/utils";
import type { Permissions } from "@/features/authorization/types";

export const hasFreshNotesPermission = async (userId: string, action: Permissions["notes"]["action"]): Promise<boolean> => {
  try {
    const [user] = await db.select({ id: usersTable.id, roles: usersTable.roles, email: usersTable.email, name: usersTable.name, image: usersTable.image, username: usersTable.username })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) return false;
    return hasPermission({ id: user.id, roles: user.roles ?? [], email: user.email, name: user.name ?? "", image: user.image, username: user.username }, "notes", action);
  } catch {
    return false;
  }
};

export const canAccessNotes = (userId: string): Promise<boolean> => hasFreshNotesPermission(userId, "read");
