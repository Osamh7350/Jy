import { pgTable, serial, text, timestamp, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: integer().primaryKey(),
  data: jsonb().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: text().primaryKey(),
  name: text().notNull(),
  phone: text().notNull(),
  studyType: text("study_type").notNull(),
  courseId: text("course_id").notNull(),
  courseName: text("course_name").notNull(),
  fee: integer(),
  paid: integer().notNull().default(0),
  notes: text().notNull().default(""),
  repeating: boolean().notNull().default(false),
  result: text(),
  version: integer().notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("students_name_idx").on(t.name)]);

export const notices = pgTable("notices", {
  id: serial().primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  body: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("notices_student_idx").on(t.studentId)]);

export const paymentHistory = pgTable("payment_history", {
  id: serial().primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  note: text().notNull(),
  oldFee: integer("old_fee"),
  fee: integer(),
  oldPaid: integer("old_paid").notNull(),
  paid: integer().notNull(),
  staffEmail: text("staff_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("payment_history_student_idx").on(t.studentId)]);

export const inquiries = pgTable("inquiries", {
  id: text().primaryKey(),
  kind: text().notNull().default("inquiry"),
  name: text().notNull(),
  body: text().notNull(),
  studentId: text("student_id"),
  reply: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
});

export const deliveries = pgTable("deliveries", {
  id: serial().primaryKey(),
  requestId: text("request_id").notNull(),
  channel: text().notNull(),
  studentId: text("student_id").notNull(),
  body: text().notNull(),
  detail: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("deliveries_request_channel_idx").on(t.requestId, t.channel)]);
