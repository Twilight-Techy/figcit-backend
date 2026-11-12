-- AlterTable
ALTER TABLE "check_in_contexts" ADD COLUMN     "life_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "own_life_event_enc" BYTEA;
