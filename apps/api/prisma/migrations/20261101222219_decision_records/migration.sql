-- CreateEnum
CREATE TYPE "decision_mode" AS ENUM ('signed_in', 'browse');

-- CreateTable
CREATE TABLE "decision_records" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" "decision_mode" NOT NULL,
    "user_id" UUID,
    "version_id" UUID NOT NULL,
    "ruleset_hash" CHAR(64) NOT NULL,
    "engine_version" VARCHAR(20) NOT NULL,
    "input" JSONB NOT NULL,
    "card" JSONB NOT NULL,
    "trace" JSONB NOT NULL,
    "band" VARCHAR(32),
    "light" VARCHAR(16),
    "support_screen" BOOLEAN NOT NULL,
    "recheck_of_id" UUID,
    "replayed_at" TIMESTAMPTZ(3),
    "replay_matches" BOOLEAN,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "decision_records_user_id_created_at_idx" ON "decision_records"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "decision_records_created_at_idx" ON "decision_records"("created_at");

-- CreateIndex
CREATE INDEX "decision_records_version_id_idx" ON "decision_records"("version_id");

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A decision record is append-only (DESIGN §7): only the replay outcome may be written later, and
-- the account link may be cleared (account deletion, O-06). Deleting a row stays possible for
-- retention and the right to erasure.
CREATE OR REPLACE FUNCTION decision_records_append_only() RETURNS trigger AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR NEW."mode" IS DISTINCT FROM OLD."mode"
    OR (NEW."user_id" IS DISTINCT FROM OLD."user_id" AND NEW."user_id" IS NOT NULL)
    OR NEW."version_id" IS DISTINCT FROM OLD."version_id"
    OR NEW."ruleset_hash" IS DISTINCT FROM OLD."ruleset_hash"
    OR NEW."engine_version" IS DISTINCT FROM OLD."engine_version"
    OR NEW."input" IS DISTINCT FROM OLD."input"
    OR NEW."card" IS DISTINCT FROM OLD."card"
    OR NEW."trace" IS DISTINCT FROM OLD."trace"
    OR NEW."band" IS DISTINCT FROM OLD."band"
    OR NEW."light" IS DISTINCT FROM OLD."light"
    OR NEW."support_screen" IS DISTINCT FROM OLD."support_screen"
    OR NEW."recheck_of_id" IS DISTINCT FROM OLD."recheck_of_id" THEN
    RAISE EXCEPTION 'decision_records: a decision record cannot change' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER decision_records_append_only
  BEFORE UPDATE ON "decision_records"
  FOR EACH ROW EXECUTE FUNCTION decision_records_append_only();
