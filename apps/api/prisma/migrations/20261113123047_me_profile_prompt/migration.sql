-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_prompt_at" TIMESTAMPTZ(3),
ADD COLUMN     "profile_prompt_dismissals" SMALLINT NOT NULL DEFAULT 0;
