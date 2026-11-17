-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "adapt_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "break_minutes" SMALLINT,
ADD COLUMN     "step_minutes" SMALLINT;

-- AlterTable
ALTER TABLE "task_steps" ADD COLUMN     "adapt_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "later" BOOLEAN NOT NULL DEFAULT false;
