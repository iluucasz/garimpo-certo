CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
