CREATE TABLE "site_documents" (
	"key" text PRIMARY KEY NOT NULL,
	"draft" jsonb,
	"published" jsonb,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft_updated_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "site_documents" ADD CONSTRAINT "site_documents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;