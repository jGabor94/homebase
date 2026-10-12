CREATE TABLE "notes" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL,
	"title" varchar(120),
	"content" text NOT NULL,
	"visibility" varchar(16) DEFAULT 'private' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_title_length_check" CHECK ("title" is null or length("title") <= 120),
	CONSTRAINT "notes_content_length_check" CHECK (length("content") between 1 and 5000),
	CONSTRAINT "notes_visibility_check" CHECK ("visibility" in ('private', 'family')),
	CONSTRAINT "notes_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "notes_updated_at_id_idx" ON "notes" ("updated_at","id");--> statement-breakpoint
CREATE INDEX "notes_owner_updated_at_idx" ON "notes" ("owner_id","updated_at","id");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;