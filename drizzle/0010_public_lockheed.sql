ALTER TYPE "public"."privacy_request_type" ADD VALUE 'correction';--> statement-breakpoint
ALTER TYPE "public"."privacy_request_type" ADD VALUE 'information';--> statement-breakpoint
ALTER TYPE "public"."privacy_request_type" ADD VALUE 'revocation';--> statement-breakpoint
ALTER TYPE "public"."privacy_request_type" ADD VALUE 'other';--> statement-breakpoint
ALTER TABLE "privacy_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "privacy_requests" ADD COLUMN "response_note" text;