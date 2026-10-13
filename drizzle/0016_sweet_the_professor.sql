CREATE TABLE "ab_experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"hypothesis" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"variant_b" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"split_b" integer DEFAULT 50 NOT NULL,
	"winner" text,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ab_experiments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "ab_experiments" ADD CONSTRAINT "ab_experiments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;