import { Session } from "next-auth"

export type Role = "admin" | "user"

export type PermissionCheck<Key extends keyof Permissions> =
    | boolean
    | ((user: Session["user"], data: Permissions[Key]["dataType"]) => boolean)

export type RolesWithPermissions = {
    [R in Role]: Partial<{
        [Key in keyof Permissions]: Partial<{
            [Action in Permissions[Key]["action"]]: PermissionCheck<Key>
        }>
    }>
}

export type Permissions = {
    allowedGoogleEmail: {
        dataType: never
        action: "read" | "create" | "delete"
    },
    changelog: {
        dataType: never
        action: "create" | "delete"
    },
}
