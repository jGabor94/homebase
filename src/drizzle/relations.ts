import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	accountsTable: {
		user: r.one.usersTable({
			from: r.accountsTable.userId,
			to: r.usersTable.id
		}),
	},
	usersTable: {
		accounts: r.many.accountsTable(),
	},
	monthlyExpenseReportsTable: {
		invoices: r.many.invoicesTable(),
	},
	invoicesTable: {
		report: r.one.monthlyExpenseReportsTable({
			from: r.invoicesTable.reportId,
			to: r.monthlyExpenseReportsTable.id,
		}),
	},
}))
