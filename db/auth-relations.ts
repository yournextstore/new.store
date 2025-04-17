import { relations } from "drizzle-orm";
import {
	accounts,
	invitations,
	members,
	organizations,
	sessions,
	users2s,
} from "./auth-schema";

export const users2Relations = relations(users2s, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	members: many(members),
	invitations: many(invitations),
}));
export const sessionRelations = relations(sessions, ({ one }) => ({
	user: one(users2s, { references: [users2s.id], fields: [sessions.userId] }),
}));
export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users2s, { references: [users2s.id], fields: [accounts.userId] }),
}));
export const organizationsRelations = relations(
	organizations,
	({ many, one }) => ({
		members: many(members),
		invitations: many(invitations),
	}),
);
export const membersRelations = relations(members, ({ one }) => ({
	organization: one(organizations, {
		references: [organizations.id],
		fields: [members.organizationId],
	}),
	user: one(users2s, { references: [users2s.id], fields: [members.userId] }),
}));
export const invitationsRelations = relations(invitations, ({ one }) => ({
	organizations: one(organizations, {
		references: [organizations.id],
		fields: [invitations.organizationId],
	}),
	inviter: one(users2s, {
		references: [users2s.id],
		fields: [invitations.inviterId],
	}),
}));
