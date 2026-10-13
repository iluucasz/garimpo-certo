CREATE TABLE "engine_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"decision_note" text,
	"applied_at" timestamp with time zone,
	"result" jsonb,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "engine_proposals" ADD CONSTRAINT "engine_proposals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engine_proposals_status_idx" ON "engine_proposals" USING btree ("status" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "engine_proposals_subject_idx" ON "engine_proposals" USING btree ("kind" text_ops,"subject_id" text_ops);