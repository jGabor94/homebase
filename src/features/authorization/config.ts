import { RolesWithPermissions } from "./types";

export const ROLES = {
    admin: {
        allowedGoogleEmail: {
            read: true,
            create: true,
            delete: true,
        },
        changelog: {
            create: true,
            delete: true,
        }
    },
    user: {}
} as const as RolesWithPermissions
