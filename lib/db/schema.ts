import { pgTable, text, timestamp, boolean, uuid, pgEnum } from "drizzle-orm/pg-core";

export const leadStatus = pgEnum("lead_status", ["new", "contacted", "booked", "closed"]);
export const priority = pgEnum("priority", ["hot", "warm", "general"]);
export const runStatus = pgEnum("run_status", ["ok", "failed", "skipped"]);

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  heardAbout: text("heard_about"),
  hasGroupon: boolean("has_groupon").default(false).notNull(),
  serviceCategory: text("service_category"),
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  contactMethod: text("contact_method"),
  message: text("message").notNull(),
  status: leadStatus("status").default("new").notNull(),
});

// Kept separate from leads so a failed or re-run classification never touches what the guest
// actually submitted.
export const leadAi = pgTable("lead_ai", {
  leadId: uuid("lead_id")
    .primaryKey()
    .references(() => leads.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  category: text("category").notNull(),
  serviceInterest: text("service_interest"),
  priority: priority("priority").notNull(),
  needsStaff: boolean("needs_staff").notNull(),
  escalationReason: text("escalation_reason"),
  draftResponse: text("draft_response").notNull(),
  nextAction: text("next_action").notNull(),
  // The appointment times offered to this guest, as JSON. A separate table would be right if the
  // spa were holding them; nothing is held here, so this stays a record of what was suggested.
  proposedSlots: text("proposed_slots"),
  model: text("model").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per automation step per lead. A step that was skipped is recorded as skipped rather
// than left absent, so "nothing ran" and "it ran and decided not to act" look different.
export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("lead_id")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  step: text("step").notNull(),
  status: runStatus("status").notNull(),
  detail: text("detail"),
  ranAt: timestamp("ran_at").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadAi = typeof leadAi.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;
