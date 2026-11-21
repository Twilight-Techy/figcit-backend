-- CreateEnum
CREATE TYPE "testimonial_status" AS ENUM ('pending', 'approved', 'hidden');

-- CreateTable
CREATE TABLE "tester_surveys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "navigation" SMALLINT NOT NULL,
    "check_in" SMALLINT NOT NULL,
    "fit" SMALLINT NOT NULL,
    "accuracy" SMALLINT NOT NULL,
    "overall" SMALLINT NOT NULL,
    "comment" VARCHAR(2000),
    "asked_at" VARCHAR(16) NOT NULL,
    "app_version" VARCHAR(40),
    "testimonial" VARCHAR(600),
    "testimonial_public" BOOLEAN NOT NULL DEFAULT false,
    "testimonial_name" VARCHAR(60),
    "testimonial_status" "testimonial_status",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tester_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tester_survey_prompts" (
    "user_id" UUID NOT NULL,
    "skips" SMALLINT NOT NULL DEFAULT 0,
    "ask_after" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tester_survey_prompts_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tester_surveys_user_id_key" ON "tester_surveys"("user_id");

-- CreateIndex
CREATE INDEX "tester_surveys_updated_at_idx" ON "tester_surveys"("updated_at");

-- CreateIndex
CREATE INDEX "tester_surveys_testimonial_status_idx" ON "tester_surveys"("testimonial_status");

-- AddForeignKey
ALTER TABLE "tester_surveys" ADD CONSTRAINT "tester_surveys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tester_survey_prompts" ADD CONSTRAINT "tester_survey_prompts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

