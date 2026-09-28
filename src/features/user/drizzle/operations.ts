"server only"

import { db } from "@/drizzle/db"

export const getUserDataQuery = async (userid: string) => db.query.usersTable.findFirst({
    where: { id: userid },
    columns: {
        password: false
    }
})

