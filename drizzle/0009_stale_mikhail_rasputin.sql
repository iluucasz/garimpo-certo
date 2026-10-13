CREATE TABLE "affiliate_conversion_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversion_id" uuid NOT NULL,
	"offer_id" uuid,
	"external_item_id" text NOT NULL,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"refund_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"item_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD COLUMN "sub_ids" text;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD COLUMN "buyer_type" text;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "affiliate_sub_ids" text;--> statement-breakpoint
ALTER TABLE "affiliate_conversion_items" ADD CONSTRAINT "affiliate_conversion_items_conversion_id_affiliate_conversions_" FOREIGN KEY ("conversion_id") REFERENCES "public"."affiliate_conversions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversion_items" ADD CONSTRAINT "affiliate_conversion_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_conversion_items_conversion_idx" ON "affiliate_conversion_items" USING btree ("conversion_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "affiliate_conversion_items_offer_idx" ON "affiliate_conversion_items" USING btree ("offer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "affiliate_conversions_converted_idx" ON "affiliate_conversions" USING btree ("converted_at" timestamptz_ops);