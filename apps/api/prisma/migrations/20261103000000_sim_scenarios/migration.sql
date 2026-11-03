-- The staff Simulator's saved scenarios and their runs (DECISION_LOG E-61).
-- CreateTable
CREATE TABLE "sim_scenarios" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "answers" JSONB NOT NULL,
    "request" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_scenario_runs" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "label" VARCHAR(40) NOT NULL,
    "ran_by" UUID NOT NULL,
    "ran_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" JSONB NOT NULL,

    CONSTRAINT "sim_scenario_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sim_scenarios_created_at_idx" ON "sim_scenarios"("created_at");

-- CreateIndex
CREATE INDEX "sim_scenario_runs_scenario_id_ran_at_idx" ON "sim_scenario_runs"("scenario_id", "ran_at");

-- AddForeignKey
ALTER TABLE "sim_scenario_runs" ADD CONSTRAINT "sim_scenario_runs_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "sim_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

