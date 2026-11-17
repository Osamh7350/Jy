CREATE TABLE "deliveries" (
	"id" serial PRIMARY KEY,
	"request_id" text NOT NULL,
	"channel" text NOT NULL,
	"student_id" text NOT NULL,
	"body" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" text PRIMARY KEY,
	"kind" text DEFAULT 'inquiry' NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"student_id" text,
	"reply" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY,
	"student_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_history" (
	"id" serial PRIMARY KEY,
	"student_id" text NOT NULL,
	"note" text NOT NULL,
	"old_fee" integer,
	"fee" integer,
	"old_paid" integer NOT NULL,
	"paid" integer NOT NULL,
	"staff_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"study_type" text NOT NULL,
	"course_id" text NOT NULL,
	"course_name" text NOT NULL,
	"fee" integer,
	"paid" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"repeating" boolean DEFAULT false NOT NULL,
	"result" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_request_channel_idx" ON "deliveries" ("request_id","channel");--> statement-breakpoint
CREATE INDEX "notices_student_idx" ON "notices" ("student_id");--> statement-breakpoint
CREATE INDEX "payment_history_student_idx" ON "payment_history" ("student_id");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" ("name");--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;