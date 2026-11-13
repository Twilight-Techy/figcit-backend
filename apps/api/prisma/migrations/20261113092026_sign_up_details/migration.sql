-- AlterTable
ALTER TABLE "users" ADD COLUMN     "product_updates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terms_accepted_at" TIMESTAMPTZ(3),
ALTER COLUMN "nickname" SET DATA TYPE VARCHAR(120);

-- Accounts that already confirmed their age accepted the Terms when they did.
UPDATE "users" SET "terms_accepted_at" = "age_confirmed_at" WHERE "age_confirmed_at" IS NOT NULL;
