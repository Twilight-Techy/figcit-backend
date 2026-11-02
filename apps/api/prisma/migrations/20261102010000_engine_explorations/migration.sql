-- CreateEnum
CREATE TYPE "exploration_kind" AS ENUM ('explore', 'compare', 'impact');

-- CreateEnum
CREATE TYPE "exploration_status" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "engine_explorations" (
    "id" UUID NOT NULL,
    "kind" "exploration_kind" NOT NULL,
    "status" "exploration_status" NOT NULL DEFAULT 'queued',
    "label" VARCHAR(40) NOT NULL,
    "request" JSONB NOT NULL,
    "result" JSONB,
    "error" VARCHAR(500),
    "requested_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "engine_explorations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "engine_explorations_status_created_at_idx" ON "engine_explorations"("status", "created_at");

-- CreateIndex
CREATE INDEX "engine_explorations_created_at_idx" ON "engine_explorations"("created_at");
