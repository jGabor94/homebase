import { Session } from "next-auth"
import { ROLES } from "../config"
import { Permissions, RolesWithPermissions } from "../types"

export function hasPermission<Resource extends keyof Permissions>(
    user: Session["user"],
    resource: Resource,
    action: Permissions[Resource]["action"],
    data?: Permissions[Resource]["dataType"]
) {
    return user.roles.some(role => {
        const permission = (ROLES as RolesWithPermissions)[role][resource]?.[action]
        if (permission == null) return false

        if (typeof permission === "boolean") return permission
        return data != null && permission(user, data)
    })
}






