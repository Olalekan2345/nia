CREATE TABLE "telegram_login_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"browser_secret_hash" text NOT NULL,
	"purpose" text NOT NULL,
	"user_id" uuid,
	"merchant_id" uuid,
	"next_path" text,
	"device" text,
	"match_number" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"telegram_user_id" bigint,
	"telegram_username" text,
	"telegram_name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_login_requests_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "method" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_user_id" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_username" text;--> statement-breakpoint
ALTER TABLE "telegram_login_requests" ADD CONSTRAINT "telegram_login_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_login_requests" ADD CONSTRAINT "telegram_login_requests_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_login_requests_created_idx" ON "telegram_login_requests" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_telegram_user_id_unique" UNIQUE("telegram_user_id");