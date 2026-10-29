-- CreateEnum
CREATE TYPE "struggle_answer" AS ENUM ('confirmed', 'not_now', 'never');

-- CreateTable
CREATE TABLE "struggle_confirmations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family" VARCHAR(32) NOT NULL,
    "answer" "struggle_answer" NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "struggle_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "struggle_confirmations_user_id_at_idx" ON "struggle_confirmations"("user_id", "at" DESC);

-- AddForeignKey
ALTER TABLE "struggle_confirmations" ADD CONSTRAINT "struggle_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
