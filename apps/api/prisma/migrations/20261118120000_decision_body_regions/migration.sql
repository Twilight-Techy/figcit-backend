-- AlterTable
ALTER TABLE "decision_records" ADD COLUMN     "body_regions" JSONB NOT NULL DEFAULT '[]';
