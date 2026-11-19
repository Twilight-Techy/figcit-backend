-- AlterTable
ALTER TABLE "decision_records" ADD COLUMN     "not_sure" JSONB;

-- The check-in's own answers kept beside the engine input (the body map, Not sure's taps) are part
-- of the record too: append-only like the rest (DESIGN §7). Only the replay outcome may be written
-- later, and the account link may be cleared (account deletion, O-06).
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
    OR NEW."recheck_of_id" IS DISTINCT FROM OLD."recheck_of_id"
    OR NEW."body_regions" IS DISTINCT FROM OLD."body_regions"
    OR NEW."not_sure" IS DISTINCT FROM OLD."not_sure" THEN
    RAISE EXCEPTION 'decision_records: a decision record cannot change' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
