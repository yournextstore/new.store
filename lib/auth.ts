import "server-only";

import { db, schema } from "@/db/db";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { invariant } from "./utils";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

invariant(GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID is not defined");
invariant(GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET is not defined");

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,

		// compatibility with Clerk
		password: {
			hash: (password) => bcrypt.hash(password, 10),
			verify: ({ hash, password }) => bcrypt.compare(password, hash),
		},
	},
	socialProviders: {
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET,
		},
	},
	plugins: [nextCookies(), organization()],
	session: {
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // Cache duration in seconds
		},
	},
	user: {
		modelName: "users2s",
	},

	databaseHooks: {
		session: {
			create: {
				before: async (session) => {
					const organizationId = await getActiveOrganization(session.userId);
					return {
						data: {
							...session,
							activeOrganizationId: organizationId,
						},
					};
				},
			},
		},
	},
});

export const getAuth = async () => auth.api.getSession({ headers: await headers() });

// get first organization for user
const getActiveOrganization = async (userId: string) => {
	const [organization] = await db
		.select({ organizationId: schema.members.organizationId })
		.from(schema.members)
		.where(eq(schema.members.userId, userId))
		.limit(1);
	return organization?.organizationId;
};
