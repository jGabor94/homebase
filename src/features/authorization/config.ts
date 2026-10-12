import { RolesWithPermissions } from "./types";

export const ROLES = {
    admin: {
        monthlyExpenses: {
            read: true,
            import: true,
        },
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
    user: {},
    notesMember: {
        notes: {
            read: true,
            create: true,
            update: true,
            delete: true,
        },
    },
} as const as RolesWithPermissions
