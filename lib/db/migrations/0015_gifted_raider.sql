-- drizzle-kit generated an unsafe migration for this enum value rename (it
-- diffed 'enrolled'->'unenrolled' as remove+add rather than a rename, and set
-- the new default while the column was still the OLD enum type, then would
-- have failed casting any existing 'enrolled' row into the new type, which
-- doesn't contain that value). Rewritten by hand in the correct safe order:
-- widen to text -> drop the now-invalid default -> migrate existing data ->
-- swap the enum type -> cast back -> re-apply the default.
ALTER TABLE "agents" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
UPDATE "agents" SET "status" = 'unenrolled' WHERE "status" = 'enrolled';--> statement-breakpoint
DROP TYPE "public"."agent_status";--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('unenrolled', 'active', 'idle', 'inactive', 'suspended');--> statement-breakpoint
ALTER TABLE "public"."agents" ALTER COLUMN "status" SET DATA TYPE "public"."agent_status" USING "status"::"public"."agent_status";--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "status" SET DEFAULT 'unenrolled';
