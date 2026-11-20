-- CreateEnum
CREATE TYPE "app_feedback_kind" AS ENUM ('broken', 'confusing', 'idea');

-- CreateEnum
CREATE TYPE "app_feedback_status" AS ENUM ('new', 'seen', 'done');

-- AlterEnum
ALTER TYPE "file_purpose" ADD VALUE 'feedback_screenshot';

-- CreateTable
CREATE TABLE "app_feedback" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "source" VARCHAR(16) NOT NULL,
    "kind" "app_feedback_kind" NOT NULL,
    "text" VARCHAR(2000) NOT NULL,
    "screen" VARCHAR(200),
    "app_version" VARCHAR(40),
    "device" VARCHAR(200),
    "name" VARCHAR(100),
    "email" VARCHAR(254),
    "screenshot_id" UUID,
    "status" "app_feedback_status" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_feedback_created_at_idx" ON "app_feedback"("created_at");

-- AddForeignKey
ALTER TABLE "app_feedback" ADD CONSTRAINT "app_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
