import { relations, sql } from "drizzle-orm";
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { modActions, userEvents } from "./audit";
import { bets, positions } from "./bets";
import { comments, friendlyFireEvents } from "./comments";
import { dharmaLedger } from "./dharma";
import { payoutEvents } from "./events";
import { imageUploads } from "./image-uploads";

// Per SPEC.2 §8 line 933: single auth-domain file spanning Better Auth's
// user/session/account/verification + Zugzwang's admin_sessions. AGENTS.md §6
// "one table per file" yields here to the auth-domain bundle.
//
// users — SPEC.2 B.1's 13 columns + 4 Better Auth 1.6.x core columns
// (name, email_verified, image, updated_at). SPEC.2 B.1 omits these; Better
// Auth's core reads them directly so they can't be skipped via `fields`
// rename. SPEC.2 B.1 flagged as drift for PRECURSOR.5. email is NOT NULL
// here (was NULL in SPEC.2 B.1) to match Better Auth's contract.
//
// No `role` column. No `is_admin`. Per §8.7 pillar 1 (admin has no users
// row; structural separation by data-model) — also CLAUDE.md §3.
export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		name: text("name").notNull(),
		email: text("email").notNull(),
		emailVerified: boolean("email_verified").notNull().default(false),
		image: text("image"),
		pseudonym: text("pseudonym").notNull().unique(),
		googleId: text("google_id"),
		pfpFilename: text("pfp_filename"),
		tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
		tosVersionHash: text("tos_version_hash"),
		privacyVersionHash: text("privacy_version_hash"),
		tosAcceptanceIp: text("tos_acceptance_ip"),
		tosAcceptanceUserAgent: text("tos_acceptance_user_agent"),
		lastAllowanceAccruedAt: timestamp("last_allowance_accrued_at", {
			withTimezone: true,
		}),
		bannedAt: timestamp("banned_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("users_google_id_idx")
			.on(table.googleId)
			.where(sql`${table.googleId} IS NOT NULL`),
		index("users_banned_at_idx")
			.on(table.bannedAt)
			.where(sql`${table.bannedAt} IS NOT NULL`),
		index("users_email_idx").on(table.email),
	],
);

// Better Auth 1.6.x core session shape. expires_at NULL because
// disableSessionRefresh=true per SPEC.2 §8.2 line 809.
export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("sessions_user_id_idx").on(table.userId)],
);

// Better Auth 1.6.x core account shape (OAuth provider linkage). `password`
// is text NULL — unused in v1 (no credentials auth); future enable needs no
// migration.
export const accounts = pgTable(
	"accounts",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		providerId: text("provider_id").notNull(),
		accountId: text("account_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("accounts_user_id_idx").on(table.userId),
		uniqueIndex("accounts_provider_account_idx").on(
			table.providerId,
			table.accountId,
		),
	],
);

// Better Auth 1.6.x core verification shape (Email-OTP per §8.2 line 805).
export const verifications = pgTable(
	"verifications",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// SPEC.2 §8.4 line 861 — 3 columns, PK is session_id (not 'id'). No FK to
// users per §8.7 pillar 5: admin has no users row; admin_sessions is the
// sole admin identity surface. Hand-rolled static-password auth (ADR-0004 +
// ADR-0010).
export const adminSessions = pgTable("admin_sessions", {
	sessionId: uuid("session_id").primaryKey().default(sql`uuidv7()`),
	issuedAt: timestamp("issued_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	comments: many(comments),
	bets: many(bets),
	positions: many(positions),
	friendlyFireEvents: many(friendlyFireEvents),
	dharmaLedger: many(dharmaLedger),
	payoutEvents: many(payoutEvents),
	modActions: many(modActions),
	userEvents: many(userEvents),
	imageUploads: many(imageUploads),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertSessionSchema = createInsertSchema(sessions);
export const selectSessionSchema = createSelectSchema(sessions);
export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);
export const insertVerificationSchema = createInsertSchema(verifications);
export const selectVerificationSchema = createSelectSchema(verifications);
export const insertAdminSessionSchema = createInsertSchema(adminSessions);
export const selectAdminSessionSchema = createSelectSchema(adminSessions);
