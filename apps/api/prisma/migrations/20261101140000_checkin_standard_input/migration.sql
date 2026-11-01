-- Check-in input without silent defaults (DECISION_LOG E-41, E-45): unrated feelings, several
-- supports, a skipped state, and custom places linked to a standard place.
-- AlterEnum
ALTER TYPE "check_in_source" ADD VALUE 'not_given';

-- AlterTable
ALTER TABLE "check_in_contexts" ADD COLUMN     "supports" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "check_in_emotions" ALTER COLUMN "intensity" DROP NOT NULL;

-- AlterTable
ALTER TABLE "custom_tags" ADD COLUMN     "like_code" VARCHAR(48);

