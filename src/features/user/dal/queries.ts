"use server"

import { Dal } from "@/lib/dal"
import { createErrorReturn, createSuccessReturn } from "@/lib/dal/types"
import { getUserDataQuery } from "../drizzle/operations"

export const getUserData = Dal.create()
    .authenticate()
    .operation(async ({ user: { id: userid } }) => {
        const user = await getUserDataQuery(userid)
        if (!user) return createErrorReturn({ type: "not-found" })
        return createSuccessReturn(user)
    })